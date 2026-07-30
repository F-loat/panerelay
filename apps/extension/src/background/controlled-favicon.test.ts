import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL,
  applyControlledFavicon,
  overrideControlledFavicon,
  releaseControlledFavicon,
  restoreControlledFavicon,
} from './controlled-favicon.js';

test('uses the agent-browser mark with a green control dot', () => {
  const svg = decodeURIComponent(AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL.split(',')[1]);
  assert.match(svg, /data-control-engine="agent-browser"/);
  assert.match(svg, /<rect width="128" height="128" rx="28" fill="#000000"\/>/);
  assert.match(svg, /M64 31L96 88H32L64 31Z/);
  assert.match(svg, /fill="#20E68F"/);
  assert.match(svg, /cx="104" cy="104"/);
});

test('injects and restores the favicon in the requested tab', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    scripting: {
      executeScript: async (details: Record<string, unknown>) => {
        calls.push(details);
        return [];
      },
    },
  } as typeof chrome;

  try {
    assert.equal(await applyControlledFavicon(17), true);
    assert.equal(await releaseControlledFavicon(17), true);
  } finally {
    globalThis.chrome = previousChrome;
  }

  assert.deepEqual(calls[0].target, { tabId: 17 });
  assert.equal(calls[0].func, overrideControlledFavicon);
  assert.deepEqual(calls[0].args, [AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL]);
  assert.equal(calls[0].injectImmediately, true);
  assert.deepEqual(calls[1].target, { tabId: 17 });
  assert.equal(calls[1].func, restoreControlledFavicon);
});

test('keeps indicator failures separate from browser control', async () => {
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    scripting: {
      executeScript: async () => {
        throw new Error('Cannot access this page');
      },
    },
  } as typeof chrome;

  try {
    assert.equal(await applyControlledFavicon(23), false);
    assert.equal(await releaseControlledFavicon(23), false);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('preserves the original favicon and updates idempotently', () => {
  class FakeLink {
    rel = '';
    href = '';
    private readonly attributes = new Map<string, string>();

    constructor(private readonly owner: FakeHead) {}

    setAttribute(name: string, value: string): void {
      this.attributes.set(name, value);
    }

    hasAttribute(name: string): boolean {
      return this.attributes.has(name);
    }

    cloneNode(): FakeLink {
      const clone = new FakeLink(this.owner);
      clone.rel = this.rel;
      clone.href = this.href;
      for (const [name, value] of this.attributes) clone.setAttribute(name, value);
      return clone;
    }

    remove(): void {
      this.owner.children = this.owner.children.filter(child => child !== this);
    }
  }

  class FakeHead {
    children: FakeLink[] = [];

    querySelector(selector: string): FakeLink | null {
      if (selector !== 'link[data-panerelay-controlled-favicon]') return null;
      return (
        this.children.find(link => link.hasAttribute('data-panerelay-controlled-favicon')) ?? null
      );
    }

    appendChild(link: FakeLink): FakeLink {
      this.children.push(link);
      return link;
    }
  }

  class FakeMutationObserver {
    static latest: FakeMutationObserver | undefined;

    constructor(readonly callback: () => void) {
      FakeMutationObserver.latest = this;
    }

    observe(): void {}

    disconnect(): void {}
  }

  const head = new FakeHead();
  const original = new FakeLink(head);
  original.rel = 'icon';
  original.href = 'https://example.test/original.png';
  head.appendChild(original);
  const documentStub = {
    head,
    querySelectorAll(selector: string): FakeLink[] {
      if (selector === 'link[data-panerelay-controlled-favicon]') {
        return head.children.filter(link => link.hasAttribute('data-panerelay-controlled-favicon'));
      }
      return head.children.filter(
        link =>
          link.rel.split(/\s+/).includes('icon') &&
          !link.hasAttribute('data-panerelay-controlled-favicon'),
      );
    },
    createElement(): FakeLink {
      return new FakeLink(head);
    },
    addEventListener(): void {},
    removeEventListener(): void {},
  };
  const windowStub: Record<string, unknown> = {};
  windowStub.top = windowStub;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.window = windowStub as unknown as Window & typeof globalThis;
  globalThis.document = documentStub as unknown as Document;
  globalThis.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver;

  try {
    overrideControlledFavicon('data:image/svg+xml,first');
    assert.deepEqual(
      head.children.map(link => link.href),
      ['data:image/svg+xml,first'],
    );

    overrideControlledFavicon('data:image/svg+xml,second');
    assert.deepEqual(
      head.children.map(link => link.href),
      ['data:image/svg+xml,second'],
    );

    const replacement = new FakeLink(head);
    replacement.rel = 'icon';
    replacement.href = 'https://example.test/replacement.png';
    head.appendChild(replacement);
    FakeMutationObserver.latest?.callback();
    assert.deepEqual(
      head.children.map(link => link.href),
      ['data:image/svg+xml,second'],
    );

    restoreControlledFavicon();
    assert.deepEqual(
      head.children.map(link => link.href),
      ['https://example.test/original.png'],
    );
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.MutationObserver = previousMutationObserver;
  }
});
