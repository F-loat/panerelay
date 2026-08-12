import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEBSITE_APPEARANCE_MESSAGE_TYPE,
  WEBSITE_APPEARANCE_PORT_NAME,
  WebsiteAppearancePublisher,
  isOfficialWebsiteAppearancePort,
  type WebsiteAppearanceMessage,
  type WebsiteAppearancePort,
} from './website-appearance.js';

class FakePort implements WebsiteAppearancePort {
  readonly messages: WebsiteAppearanceMessage[] = [];
  readonly disconnectListeners = new Set<() => void>();
  disconnected = false;
  throwOnPost = false;

  readonly onDisconnect = {
    addListener: (listener: () => void) => this.disconnectListeners.add(listener),
    removeListener: (listener: () => void) => this.disconnectListeners.delete(listener),
  };

  constructor(
    readonly name = WEBSITE_APPEARANCE_PORT_NAME,
    readonly sender: { origin?: string; url?: string } | undefined = {
      origin: 'https://f-loat.github.io',
      url: 'https://f-loat.github.io/panerelay/zh-CN/',
    },
  ) {}

  postMessage(message: WebsiteAppearanceMessage): void {
    if (this.throwOnPost) throw new Error('port closed');
    this.messages.push(message);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  emitDisconnect(): void {
    for (const listener of [...this.disconnectListeners]) listener();
  }
}

test('accepts only the named port from the exact official website project route', () => {
  assert.equal(isOfficialWebsiteAppearancePort(new FakePort()), true);
  assert.equal(
    isOfficialWebsiteAppearancePort(
      new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {
        url: 'https://f-loat.github.io/panerelay/compare/?from=test',
      }),
    ),
    true,
  );

  for (const port of [
    new FakePort('unexpected'),
    new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {}),
    new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {
      url: 'https://f-loat.github.io/another-project/',
    }),
    new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {
      origin: 'https://attacker.example',
      url: 'https://f-loat.github.io/panerelay/',
    }),
    new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {
      url: 'https://f-loat.github.io.evil.example/panerelay/',
    }),
  ]) {
    assert.equal(isOfficialWebsiteAppearancePort(port), false);
  }
});

test('publishes the current palette on connect and new palettes to every live website', async () => {
  const publisher = new WebsiteAppearancePublisher(async () => '#336699');
  const first = new FakePort();
  const second = new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {
    url: 'https://f-loat.github.io/panerelay/compare/',
  });

  publisher.connect(first);
  publisher.connect(second);
  await Promise.resolve();

  assert.equal(publisher.connectionCount, 2);
  assert.deepEqual(first.messages, second.messages);
  assert.equal(first.messages[0]?.type, WEBSITE_APPEARANCE_MESSAGE_TYPE);
  assert.deepEqual(first.messages[0]?.accent, {
    primary: '#5680ab',
    soft: '#9ab3cd',
    dark: '#16212c',
  });

  publisher.publishAccent('#aabbcc');
  assert.equal(first.messages.at(-1)?.accent.primary, '#aabbcc');
  assert.equal(second.messages.at(-1)?.accent.primary, '#aabbcc');

  first.emitDisconnect();
  publisher.publishAccent('#445566');
  assert.equal(publisher.connectionCount, 1);
  assert.equal(first.messages.at(-1)?.accent.primary, '#aabbcc');
  assert.notEqual(second.messages.at(-1)?.accent.primary, '#aabbcc');
});

test('rejects unsupported senders and cleans up failed posts without reading storage', async () => {
  let reads = 0;
  const publisher = new WebsiteAppearancePublisher(async () => {
    reads += 1;
    return '#336699';
  });
  const invalid = new FakePort(WEBSITE_APPEARANCE_PORT_NAME, {
    url: 'https://example.test/panerelay/',
  });
  publisher.connect(invalid);
  await Promise.resolve();

  assert.equal(invalid.disconnected, true);
  assert.equal(reads, 0);

  const failed = new FakePort();
  failed.throwOnPost = true;
  publisher.connect(failed);
  await Promise.resolve();
  assert.equal(failed.disconnected, true);
  assert.equal(publisher.connectionCount, 0);
});

test('does not publish a stale initial read after a newer accent change', async () => {
  let resolveAccent: ((value: unknown) => void) | undefined;
  const publisher = new WebsiteAppearancePublisher(
    () => new Promise(resolve => (resolveAccent = resolve)),
  );
  const port = new FakePort();
  publisher.connect(port);
  publisher.publishAccent('#aabbcc');
  resolveAccent?.('#336699');
  await Promise.resolve();

  assert.equal(port.messages.length, 1);
  assert.equal(port.messages[0]?.accent.primary, '#aabbcc');
});
