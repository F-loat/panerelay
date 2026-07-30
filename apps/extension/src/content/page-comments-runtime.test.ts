import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { installPageCommentsRuntime } from './page-comments-runtime.js';

describe('page comment runtime', () => {
  afterEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    delete (window as typeof window & { __panerelayPageCommentsRuntime?: boolean })
      .__panerelayPageCommentsRuntime;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('installs once and emits bounded element comments', async () => {
    const sent: Array<Record<string, unknown>> = [];
    let listener: ((message: unknown) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener(next: (message: unknown) => void) {
            listener = next;
          },
        },
        async sendMessage(message: Record<string, unknown>) {
          sent.push(message);
        },
      },
    });
    const target = document.createElement('button');
    target.className = 'primary';
    target.textContent = 'Continue';
    document.body.append(target);

    expect(installPageCommentsRuntime()).toBe(true);
    expect(installPageCommentsRuntime()).toBe(true);
    listener?.({ type: 'panerelay.page-comments.start' });
    target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const editor = document.querySelector<HTMLElement>('[data-panerelay-page-comment-ui="editor"]');
    const textarea = editor?.shadowRoot?.querySelector('textarea');
    const save = editor?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[aria-label="Add comment"]',
    );
    expect(textarea).not.toBeNull();
    expect(save?.querySelector('path')?.getAttribute('d')).toBe('M20 6 9 17l-5-5');
    if (textarea) {
      textarea.value = 'Make this action clearer';
      textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    save?.click();
    await Promise.resolve();

    const changed = sent.find(message => message.type === 'panerelay.page-comment.changed');
    expect(changed?.source).toBe('panerelay-page-comments');
    expect(changed?.comment).toEqual(
      expect.objectContaining({
        comment: 'Make this action clearer',
        element: expect.objectContaining({
          tagName: 'button',
          text: 'Continue',
        }),
      }),
    );
    expect(document.querySelector('[data-panerelay-page-comment-ui="marker"]')).not.toBeNull();
    expect(
      sent.some(
        message => message.type === 'panerelay.page-comment.mode' && message.active === false,
      ),
    ).toBe(true);
    listener?.({ type: 'panerelay.page-comments.clear' });
  });

  it('does not capture form values and redacts sensitive page URL fields', async () => {
    const sent: Array<Record<string, unknown>> = [];
    let listener: ((message: unknown) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener(next: (message: unknown) => void) {
            listener = next;
          },
        },
        async sendMessage(message: Record<string, unknown>) {
          sent.push(message);
        },
      },
    });
    history.replaceState({}, '', '/form?token=top-secret&view=profile#session=private');
    const target = document.createElement('input');
    target.value = 'private form value';
    target.placeholder = 'Account name';
    document.body.append(target);

    installPageCommentsRuntime();
    listener?.({ type: 'panerelay.page-comments.start' });
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const editor = document.querySelector<HTMLElement>('[data-panerelay-page-comment-ui="editor"]');
    const textarea = editor?.shadowRoot?.querySelector('textarea');
    const save = editor?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[aria-label="Add comment"]',
    );
    expect(editor).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(save).toBeDefined();
    if (textarea) {
      textarea.value = 'Clarify this field';
      textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    save?.click();
    await Promise.resolve();

    const changed = sent.find(message => message.type === 'panerelay.page-comment.changed') as
      { comment?: { element?: { text?: string }; page?: { url?: string } } } | undefined;
    expect(changed).toEqual(expect.objectContaining({ comment: expect.any(Object) }));
    expect(changed?.comment?.element?.text).toBe('Account name');
    expect(changed?.comment?.page?.url).toContain('view=profile');
    expect(changed?.comment?.page?.url).not.toContain('top-secret');
    expect(changed?.comment?.page?.url).not.toContain('private');
    expect(changed?.comment?.page?.url).toContain('%5Bredacted%5D');
    listener?.({ type: 'panerelay.page-comments.clear' });
  });

  it('keeps continuous selection active and restores cancelled style previews', async () => {
    const sent: Array<Record<string, unknown>> = [];
    let listener: ((message: unknown) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener(next: (message: unknown) => void) {
            listener = next;
          },
        },
        async sendMessage(message: Record<string, unknown>) {
          sent.push(message);
        },
      },
    });
    const target = document.createElement('button');
    target.textContent = 'Continue';
    document.body.append(target);

    installPageCommentsRuntime();
    listener?.({
      type: 'panerelay.page-comments.start',
      continuous: true,
      theme: 'dark',
    });
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const editor = document.querySelector<HTMLElement>('[data-panerelay-page-comment-ui="editor"]');
    const editorStyle = editor?.shadowRoot?.querySelector('style')?.textContent;
    expect(editorStyle).toContain('color-scheme:dark');
    expect(editorStyle).toContain('--bg:#111313');
    expect(editorStyle).toContain('--accent:#35d07f');
    expect(editorStyle).toContain('max-height:min(260px');
    editor?.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Style changes"]')?.click();
    const color = editor?.shadowRoot?.querySelector<HTMLInputElement>(
      'input[type="text"][aria-label="Color"]',
    );
    const colorPicker = editor?.shadowRoot?.querySelector<HTMLInputElement>(
      'input[type="color"][aria-label="Color picker"]',
    );
    expect(color).not.toBeNull();
    expect(colorPicker).not.toBeNull();
    if (colorPicker) {
      colorPicker.value = '#ff0000';
      colorPicker.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    expect(target.style.getPropertyValue('color')).toBe('#ff0000');
    editor?.shadowRoot?.querySelector<HTMLButtonElement>('.cancel')?.click();
    expect(target.style.getPropertyValue('color')).toBe('');
    expect(document.querySelector('[data-panerelay-page-comment-ui="cursor"]')).not.toBeNull();
    expect(
      sent.some(
        message => message.type === 'panerelay.page-comment.mode' && message.active === false,
      ),
    ).toBe(false);

    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const nextEditor = document.querySelector<HTMLElement>(
      '[data-panerelay-page-comment-ui="editor"]',
    );
    nextEditor?.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Style changes"]')
      ?.click();
    const nextColor = nextEditor?.shadowRoot?.querySelector<HTMLInputElement>(
      'input[type="text"][aria-label="Color"]',
    );
    if (nextColor) {
      nextColor.value = 'rgb(0, 0, 255)';
      nextColor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    nextEditor?.shadowRoot?.querySelector<HTMLButtonElement>('.footer .confirm')?.click();
    await Promise.resolve();
    const changed = sent.find(message => message.type === 'panerelay.page-comment.changed') as
      { comment?: { id?: string; styleChanges?: Record<string, string> } } | undefined;
    expect(changed?.comment?.styleChanges).toEqual({ color: 'rgb(0, 0, 255)' });
    expect(target.style.getPropertyValue('color')).toBe('rgb(0, 0, 255)');

    const commentId = changed?.comment?.id;
    expect(commentId).toEqual(expect.any(String));
    listener?.({ type: 'panerelay.page-comments.edit', commentId });
    const editEditor = document.querySelector<HTMLElement>(
      '[data-panerelay-page-comment-ui="editor"]',
    );
    editEditor?.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Style changes"]')
      ?.click();
    const editColor = editEditor?.shadowRoot?.querySelector<HTMLInputElement>(
      'input[type="text"][aria-label="Color"]',
    );
    if (editColor) {
      editColor.value = '#00ff00';
      editColor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    expect(target.style.getPropertyValue('color')).toBe('#00ff00');

    listener?.({ type: 'panerelay.page-comments.remove', commentId });
    expect(document.querySelector('[data-panerelay-page-comment-ui="editor"]')).toBeNull();
    expect(document.querySelector('[data-panerelay-page-comment-ui="highlight"]')).toBeNull();
    expect(document.querySelector('[data-panerelay-page-comment-ui="marker"]')).toBeNull();
    expect(target.style.getPropertyValue('color')).toBe('');
    expect(
      sent.some(
        message =>
          message.type === 'panerelay.page-comment.removed' && message.commentId === commentId,
      ),
    ).toBe(true);

    listener?.({ type: 'panerelay.page-comments.clear' });
    expect(target.style.getPropertyValue('color')).toBe('');
  });

  it('moves one highlighter between elements and places a themed editor beside the target', async () => {
    let listener: ((message: unknown) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener(next: (message: unknown) => void) {
            listener = next;
          },
        },
        async sendMessage() {},
      },
    });
    const first = document.createElement('button');
    const second = document.createElement('a');
    first.textContent = 'First';
    second.textContent = 'Second';
    document.body.append(first, second);
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 24, 80, 30));
    vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(new DOMRect(180, 96, 100, 40));
    vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number) =>
      x < 100 ? first : second,
    );

    installPageCommentsRuntime();
    listener?.({ type: 'panerelay.page-comments.start', theme: 'light' });
    first.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 30, clientY: 30 }));
    const highlighter = document.querySelector<HTMLElement>(
      '[data-panerelay-page-comment-ui="highlight"]',
    );
    expect(highlighter).not.toBeNull();
    expect(highlighter?.style.transition).toContain('120ms');

    second.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 100 }),
    );
    expect(document.querySelector('[data-panerelay-page-comment-ui="highlight"]')).toBe(
      highlighter,
    );
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(highlighter?.style.left).toBe('180px');
    expect(highlighter?.style.top).toBe('96px');

    second.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 100,
      }),
    );
    const editor = document.querySelector<HTMLElement>('[data-panerelay-page-comment-ui="editor"]');
    const card = editor?.shadowRoot?.querySelector<HTMLElement>('.card');
    const editorStyle = editor?.shadowRoot?.querySelector('style')?.textContent;
    expect(editorStyle).toContain('color-scheme:light');
    expect(editorStyle).toContain('--bg:#ffffff');
    expect(editorStyle).toContain('--accent:#087f46');
    expect(card?.style.left).toBe('288px');
    expect(card?.style.top).toBe('96px');
    listener?.({ type: 'panerelay.page-comments.clear' });
  });

  it('coordinates active-frame highlights and picker pause or resume messages', () => {
    const sent: Array<Record<string, unknown>> = [];
    let listener: ((message: unknown) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener(next: (message: unknown) => void) {
            listener = next;
          },
        },
        async sendMessage(message: Record<string, unknown>) {
          sent.push(message);
        },
      },
    });
    const target = document.createElement('button');
    target.textContent = 'Inside a frame';
    document.body.append(target);

    installPageCommentsRuntime();
    listener?.({ type: 'panerelay.page-comments.start', continuous: true });
    target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));

    const frameActive = sent.find(
      message => message.type === 'panerelay.page-comment.frame-active',
    );
    expect(frameActive?.frameToken).toEqual(expect.any(String));
    expect(document.querySelector('[data-panerelay-page-comment-ui="highlight"]')).not.toBeNull();

    listener?.({
      type: 'panerelay.page-comments.frame-active',
      frameToken: 'another-frame',
    });
    expect(document.querySelector('[data-panerelay-page-comment-ui="highlight"]')).toBeNull();

    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(sent.some(message => message.type === 'panerelay.page-comment.picker-paused')).toBe(
      true,
    );
    listener?.({ type: 'panerelay.page-comments.pause' });
    expect(document.querySelector('[data-panerelay-page-comment-ui="cursor"]')).toBeNull();

    document
      .querySelector<HTMLElement>('[data-panerelay-page-comment-ui="editor"]')
      ?.shadowRoot?.querySelector<HTMLButtonElement>('.cancel')
      ?.click();
    expect(sent.some(message => message.type === 'panerelay.page-comment.picker-resumed')).toBe(
      true,
    );
    listener?.({ type: 'panerelay.page-comments.resume' });
    expect(document.querySelector('[data-panerelay-page-comment-ui="cursor"]')).not.toBeNull();

    listener?.({ type: 'panerelay.page-comments.clear' });
  });

  it('keeps top-page and selected-frame evidence separate inside an iframe', async () => {
    const topWindow = new Window({ url: 'https://top.example/app' });
    const frameWindow = new Window({ url: 'https://embed.example/widget?token=secret' });
    Object.defineProperty(frameWindow, 'top', { value: topWindow });
    frameWindow.document.title = 'Embedded widget';
    const sent: Array<Record<string, unknown>> = [];
    let listener: ((message: unknown) => void) | undefined;
    Object.assign(frameWindow, {
      chrome: {
        runtime: {
          onMessage: {
            addListener(next: (message: unknown) => void) {
              listener = next;
            },
          },
          async sendMessage(message: Record<string, unknown>) {
            sent.push(message);
          },
        },
      },
    });
    const target = frameWindow.document.createElement('button');
    target.textContent = 'Embedded action';
    frameWindow.document.body.append(target);

    expect(frameWindow.eval(`(${installPageCommentsRuntime.toString()})()`)).toBe(true);
    listener?.({
      type: 'panerelay.page-comments.start',
      topPage: {
        url: 'https://top.example/app',
        title: 'Top application',
      },
    });
    target.dispatchEvent(new frameWindow.MouseEvent('click', { bubbles: true, cancelable: true }));
    const editor = frameWindow.document.querySelector<HTMLElement>(
      '[data-panerelay-page-comment-ui="editor"]',
    );
    const textarea = editor?.shadowRoot?.querySelector('textarea');
    if (textarea) {
      textarea.value = 'Update the embedded action';
      textarea.dispatchEvent(new frameWindow.Event('input', { bubbles: true }));
    }
    editor?.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[aria-label="Add comment"]')
      ?.click();
    await Promise.resolve();

    const changed = sent.find(message => message.type === 'panerelay.page-comment.changed') as
      | {
          comment?: {
            frame?: { title?: string; url?: string };
            page?: { title?: string; url?: string };
          };
        }
      | undefined;
    expect(changed?.comment?.page).toEqual({
      url: 'https://top.example/app',
      title: 'Top application',
    });
    expect(changed?.comment?.frame).toEqual(
      expect.objectContaining({
        url: 'https://embed.example/widget?token=%5Bredacted%5D',
        title: 'Embedded widget',
      }),
    );
  });

  it('uses the visual viewport and touch drag/release selection in mobile emulation', () => {
    let listener: ((message: unknown) => void) | undefined;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal('visualViewport', {
      offsetLeft: 20,
      offsetTop: 30,
      width: 375,
      height: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener(next: (message: unknown) => void) {
            listener = next;
          },
        },
        async sendMessage() {},
      },
    });
    const target = document.createElement('button');
    target.textContent = 'Touch target';
    document.body.append(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 70, 80, 40));
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);

    installPageCommentsRuntime();
    listener?.({
      type: 'panerelay.page-comments.start',
      locale: 'zh-CN',
      theme: 'dark',
    });
    const cursorStyle = document.querySelector<HTMLStyleElement>(
      '[data-panerelay-page-comment-ui="cursor"]',
    );
    expect(cursorStyle?.textContent).toContain('touch-action:none');
    expect(
      document.querySelector('[data-panerelay-page-comment-ui="hint"]')?.textContent,
    ).toContain('松手确认选取');

    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(touchMove, 'touches', {
      value: [{ clientX: 70, clientY: 90 }],
    });
    target.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);
    expect(document.querySelector('[data-panerelay-page-comment-ui="highlight"]')).not.toBeNull();

    const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperty(touchEnd, 'changedTouches', {
      value: [{ clientX: 70, clientY: 90 }],
    });
    target.dispatchEvent(touchEnd);
    expect(touchEnd.defaultPrevented).toBe(true);
    expect(document.querySelector('[data-panerelay-page-comment-ui="hint"]')).toBeNull();
    const editor = document.querySelector<HTMLElement>('[data-panerelay-page-comment-ui="editor"]');
    const card = editor?.shadowRoot?.querySelector<HTMLElement>('.card');
    expect(card?.style.width).toBe('316px');
    expect(card?.style.left).toBe('50px');
    expect(card?.style.top).toBe('118px');
    expect(editor?.shadowRoot?.querySelector('style')?.textContent).toContain(
      '@media (pointer:coarse)',
    );
    listener?.({ type: 'panerelay.page-comments.clear' });
  });
});
