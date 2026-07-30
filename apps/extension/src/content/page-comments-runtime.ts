export function installPageCommentsRuntime(): boolean {
  type RuntimeWindow = typeof window & {
    __panerelayPageCommentsRuntime?: boolean;
  };
  type Rect = { height: number; left: number; top: number; width: number };
  type ViewportBounds = Rect;
  type StyleProperty =
    | 'color'
    | 'backgroundColor'
    | 'opacity'
    | 'fontFamily'
    | 'fontSize'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'textAlign'
    | 'borderRadius'
    | 'borderColor'
    | 'borderWidth'
    | 'width'
    | 'height'
    | 'padding'
    | 'margin';
  type ChangeProperty = StyleProperty | 'textContent';
  type StyleChanges = Partial<Record<ChangeProperty, string>>;
  type ElementEvidence = {
    ariaLabel?: string;
    computedStyle: Partial<Record<StyleProperty, string>>;
    id?: string;
    role?: string;
    selector: string;
    tagName: string;
    text: string;
    rect: Rect;
    xpath?: string;
  };
  type OriginalStyle = { priority: string; value: string };
  type DocumentEvidence = {
    title: string;
    url: string;
    viewport?: { height: number; width: number };
  };
  type CommentRecord = {
    comment: string;
    element: ElementEvidence;
    frame?: DocumentEvidence;
    id: string;
    marker: HTMLElement;
    markerCleanup: () => void;
    originalStyles: Map<StyleProperty, OriginalStyle>;
    originalText: string;
    page: DocumentEvidence;
    styleChanges: StyleChanges;
    target: Element;
  };
  type EditorHandle = {
    cancel: () => void;
    commentId?: string;
    destroy: (restore: boolean) => void;
  };

  const runtimeWindow = window as RuntimeWindow;
  if (runtimeWindow.__panerelayPageCommentsRuntime) return true;
  runtimeWindow.__panerelayPageCommentsRuntime = true;

  const UI_ATTRIBUTE = 'data-panerelay-page-comment-ui';
  const FRAME_TOKEN = `page-comment-frame-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const STYLE_PROPERTIES: StyleProperty[] = [
    'color',
    'backgroundColor',
    'opacity',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'borderRadius',
    'borderColor',
    'borderWidth',
    'width',
    'height',
    'padding',
    'margin',
  ];
  const ENGLISH_PROPERTY_LABELS: Record<ChangeProperty, string> = {
    textContent: 'Text content',
    color: 'Color',
    backgroundColor: 'Background',
    opacity: 'Opacity',
    fontFamily: 'Font',
    fontSize: 'Font size',
    fontWeight: 'Weight',
    lineHeight: 'Line height',
    letterSpacing: 'Letter spacing',
    textAlign: 'Text align',
    margin: 'Margin',
    padding: 'Padding',
    borderRadius: 'Radius',
    borderColor: 'Border color',
    borderWidth: 'Border width',
    width: 'Width',
    height: 'Height',
  };
  const CHINESE_PROPERTY_LABELS: Record<ChangeProperty, string> = {
    textContent: '文本内容',
    color: '文字颜色',
    backgroundColor: '背景颜色',
    opacity: '透明度',
    fontFamily: '字体',
    fontSize: '字号',
    fontWeight: '字重',
    lineHeight: '行高',
    letterSpacing: '字间距',
    textAlign: '对齐方式',
    margin: '外边距',
    padding: '内边距',
    borderRadius: '圆角',
    borderColor: '边框颜色',
    borderWidth: '边框宽度',
    width: '宽度',
    height: '高度',
  };
  let propertyLabels = ENGLISH_PROPERTY_LABELS;
  let uiLabels = {
    add: 'Add comment',
    cancel: 'Cancel',
    edit: 'Edit page comment',
    move: 'Move annotation panel',
    placeholder: 'Describe what should change…',
    save: 'Save comment',
    style: 'Style changes',
    touchHint: 'Drag to highlight · Release to select',
  };
  const comments = new Map<string, CommentRecord>();
  let sequence = 0;
  let modeActive = false;
  let continuousMode = false;
  let highlighted: Element | null = null;
  let highlighter: HTMLDivElement | null = null;
  let highlighterFrame = 0;
  let touchHint: HTMLDivElement | null = null;
  let cursorStyle: HTMLStyleElement | null = null;
  let editor: EditorHandle | null = null;
  let pickerFrameActive = false;
  let topPageEvidence: DocumentEvidence | null = null;
  let uiTheme: 'dark' | 'light' =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';

  const bounded = (value: string | null | undefined, maximum: number) =>
    (value || '').replace(/\s+/g, ' ').trim().slice(0, maximum);
  const cssName = (property: StyleProperty) =>
    property.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
  const styledElement = (target: Element): HTMLElement | SVGElement | null =>
    target instanceof HTMLElement || target instanceof SVGElement ? target : null;
  const canEditText = (target: Element) =>
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !(target instanceof HTMLSelectElement) &&
    target.children.length === 0;
  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  const finiteNumber = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
  const viewportBounds = (): ViewportBounds => {
    const viewport = window.visualViewport;
    return viewport
      ? {
          left: finiteNumber(viewport.offsetLeft),
          top: finiteNumber(viewport.offsetTop),
          width: finiteNumber(viewport.width, window.innerWidth),
          height: finiteNumber(viewport.height, window.innerHeight),
        }
      : {
          left: 0,
          top: 0,
          width: finiteNumber(window.innerWidth, document.documentElement.clientWidth),
          height: finiteNumber(window.innerHeight, document.documentElement.clientHeight),
        };
  };
  const touchPrimary = () =>
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
    navigator.maxTouchPoints > 0;
  const commentAccent = () =>
    uiTheme === 'light'
      ? {
          color: '#087f46',
          contrast: '#ffffff',
          hover: '#066c3c',
          outline: '#ffffff',
          soft: 'rgba(8,127,70,.12)',
        }
      : {
          color: '#35d07f',
          contrast: '#06150d',
          hover: '#56df96',
          outline: '#0b0c0c',
          soft: 'rgba(53,208,127,.14)',
        };
  const colorToHex = (value: string): string | null => {
    const trimmed = value.trim();
    const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(trimmed);
    if (shortHex) {
      return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`;
    }
    const hex = /^#[\da-f]{6}$/i.exec(trimmed);
    if (hex) return hex[0];
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(
      trimmed,
    );
    if (!rgb) return null;
    return `#${rgb
      .slice(1, 4)
      .map(channel =>
        clamp(Math.round(Number(channel)), 0, 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
  };

  const send = (message: Record<string, unknown>) => {
    void chrome.runtime
      .sendMessage({ ...message, source: 'panerelay-page-comments' })
      .catch(() => undefined);
  };
  const announceFrameActive = () => {
    if (pickerFrameActive) return;
    pickerFrameActive = true;
    send({ type: 'panerelay.page-comment.frame-active', frameToken: FRAME_TOKEN });
  };

  const isUiElement = (value: EventTarget | null): boolean =>
    value instanceof Element && Boolean(value.closest(`[${UI_ATTRIBUTE}]`));

  const escaped = (value: string): string => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
    return value.replace(/[^\w-]/g, character => `\\${character}`);
  };

  const selectorFor = (target: Element): string => {
    if (target.id) return `#${escaped(bounded(target.id, 200))}`;
    const segments: string[] = [];
    let current: Element | null = target;
    while (current && current !== document.documentElement && segments.length < 5) {
      let segment = current.tagName.toLowerCase();
      const classes = [...current.classList]
        .filter(name => /^[A-Za-z_-][\w-]*$/.test(name))
        .slice(0, 2);
      if (classes.length) segment += classes.map(name => `.${escaped(name)}`).join('');
      const parent: Element | null = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(child => child.tagName === current!.tagName);
        if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      segments.unshift(segment);
      current = parent;
    }
    return bounded(segments.join(' > '), 1_000) || target.tagName.toLowerCase();
  };

  const xpathFor = (target: Element): string => {
    const segments: string[] = [];
    let current: Element | null = target;
    while (current && current.nodeType === Node.ELEMENT_NODE && segments.length < 12) {
      const parent: Element | null = current.parentElement;
      const name = current.tagName.toLowerCase();
      if (!parent) {
        segments.unshift(name);
        break;
      }
      const same = [...parent.children].filter(child => child.tagName === current!.tagName);
      segments.unshift(same.length > 1 ? `${name}[${same.indexOf(current) + 1}]` : name);
      current = parent;
    }
    return bounded(`/${segments.join('/')}`, 1_000);
  };

  const visibleText = (target: Element): string => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return bounded(target.placeholder, 500);
    }
    if (target instanceof HTMLSelectElement) {
      return bounded(target.selectedOptions[0]?.text || target.value, 500);
    }
    return bounded((target as HTMLElement).innerText || target.textContent, 500);
  };

  const evidenceFor = (target: Element): ElementEvidence => {
    const rect = target.getBoundingClientRect();
    const liveStyle = getComputedStyle(target);
    const computedStyle = Object.fromEntries(
      STYLE_PROPERTIES.map(property => [property, liveStyle.getPropertyValue(cssName(property))]),
    ) as Partial<Record<StyleProperty, string>>;
    const id = bounded(target.id, 200);
    const role = bounded(target.getAttribute('role'), 100);
    const ariaLabel = bounded(target.getAttribute('aria-label'), 300);
    return {
      tagName: target.tagName.toLowerCase(),
      selector: selectorFor(target),
      xpath: xpathFor(target),
      text: visibleText(target),
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      computedStyle,
      ...(id ? { id } : {}),
      ...(role ? { role } : {}),
      ...(ariaLabel ? { ariaLabel } : {}),
    };
  };

  const pageEvidence = (): DocumentEvidence => {
    let url = location.href;
    try {
      const parsed = new URL(location.href);
      parsed.username = '';
      parsed.password = '';
      for (const key of [...parsed.searchParams.keys()]) {
        if (/(auth|code|credential|key|password|secret|session|sig|token)/i.test(key)) {
          parsed.searchParams.set(key, '[redacted]');
        }
      }
      if (/(auth|code|credential|key|password|secret|session|sig|token)/i.test(parsed.hash)) {
        parsed.hash = '#[redacted]';
      }
      url = parsed.toString();
    } catch {
      // Keep the bounded browser-provided URL when parsing is unavailable.
    }
    const viewport = viewportBounds();
    return {
      url: bounded(url, 2_000),
      title: bounded(document.title, 300),
      viewport: { width: Math.round(viewport.width), height: Math.round(viewport.height) },
    };
  };
  const suppliedPageEvidence = (value: unknown): DocumentEvidence | null => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (typeof record.url !== 'string' || typeof record.title !== 'string') return null;
    const viewport =
      record.viewport && typeof record.viewport === 'object'
        ? (record.viewport as Record<string, unknown>)
        : null;
    return {
      url: bounded(record.url, 2_000),
      title: bounded(record.title, 300),
      ...(viewport &&
      typeof viewport.width === 'number' &&
      Number.isFinite(viewport.width) &&
      typeof viewport.height === 'number' &&
      Number.isFinite(viewport.height)
        ? {
            viewport: {
              width: Math.max(0, Math.round(viewport.width)),
              height: Math.max(0, Math.round(viewport.height)),
            },
          }
        : {}),
    };
  };
  const commentDocumentEvidence = (): {
    frame?: DocumentEvidence;
    page: DocumentEvidence;
  } => {
    const current = pageEvidence();
    if (window.top === window || !topPageEvidence) return { page: current };
    return { page: topPageEvidence, frame: current };
  };

  const captureOriginalStyles = (target: Element) => {
    const styled = styledElement(target);
    return new Map(
      STYLE_PROPERTIES.map(property => {
        const name = cssName(property);
        return [
          property,
          {
            value: styled?.style.getPropertyValue(name) || '',
            priority: styled?.style.getPropertyPriority(name) || '',
          },
        ] as const;
      }),
    );
  };

  const writeText = (target: Element, value: string) => {
    if (canEditText(target)) target.textContent = value;
  };

  const restoreOriginal = (
    target: Element,
    originalText: string,
    originalStyles: Map<StyleProperty, OriginalStyle>,
  ) => {
    if (canEditText(target)) target.textContent = originalText;
    const styled = styledElement(target);
    if (!styled) return;
    for (const property of STYLE_PROPERTIES) {
      const name = cssName(property);
      const original = originalStyles.get(property);
      if (original?.value) styled.style.setProperty(name, original.value, original.priority);
      else styled.style.removeProperty(name);
    }
  };

  const applyChanges = (target: Element, changes: StyleChanges) => {
    if (changes.textContent && canEditText(target)) writeText(target, changes.textContent);
    const styled = styledElement(target);
    if (!styled) return;
    for (const property of STYLE_PROPERTIES) {
      const value = changes[property]?.trim();
      if (value) styled.style.setProperty(cssName(property), value, 'important');
    }
  };

  const removeHighlighter = () => {
    if (highlighterFrame) cancelAnimationFrame(highlighterFrame);
    highlighterFrame = 0;
    highlighted = null;
    highlighter?.remove();
    highlighter = null;
  };

  const positionHighlighter = () => {
    highlighterFrame = 0;
    if (!highlighted || !highlighted.isConnected || !highlighter) return;
    const rect = highlighted.getBoundingClientRect();
    highlighter.style.left = `${rect.left}px`;
    highlighter.style.top = `${rect.top}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
  };

  const highlight = (target: Element) => {
    highlighted = target;
    if (!highlighter) {
      const accent = commentAccent();
      highlighter = document.createElement('div');
      highlighter.setAttribute(UI_ATTRIBUTE, 'highlight');
      highlighter.style.cssText = [
        'all:initial',
        'position:fixed',
        'z-index:2147483645',
        'pointer-events:none',
        'display:none',
        `border:2px solid ${accent.color}`,
        'border-radius:4px',
        `background:${accent.soft}`,
        'box-sizing:border-box',
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'transition:none'
          : 'transition:top 120ms ease,left 120ms ease,width 120ms ease,height 120ms ease',
        'will-change:top,left,width,height',
      ].join(';');
      document.documentElement.append(highlighter);
    }
    highlighter.style.display = 'block';
    if (!highlighterFrame) highlighterFrame = requestAnimationFrame(positionHighlighter);
  };

  const markerPosition = (record: CommentRecord) => {
    if (!record.target.isConnected) {
      record.marker.style.display = 'none';
      return;
    }
    const rect = record.target.getBoundingClientRect();
    const viewport = viewportBounds();
    const viewportRight = viewport.left + viewport.width;
    const viewportBottom = viewport.top + viewport.height;
    if (
      rect.bottom < viewport.top ||
      rect.right < viewport.left ||
      rect.top > viewportBottom ||
      rect.left > viewportRight
    ) {
      record.marker.style.display = 'none';
      return;
    }
    record.marker.style.display = 'block';
    const markerSize = touchPrimary() ? 28 : 22;
    record.marker.style.left = `${clamp(
      rect.right - markerSize / 2,
      viewport.left + 4,
      viewportRight - markerSize - 4,
    )}px`;
    record.marker.style.top = `${clamp(
      rect.top - markerSize / 2,
      viewport.top + 4,
      viewportBottom - markerSize - 4,
    )}px`;
  };

  const removeComment = (commentId: string, notify = true) => {
    const record = comments.get(commentId);
    if (!record) return;
    if (editor?.commentId === commentId) editor.cancel();
    restoreOriginal(record.target, record.originalText, record.originalStyles);
    record.markerCleanup();
    record.marker.remove();
    comments.delete(commentId);
    if (notify) send({ type: 'panerelay.page-comment.removed', commentId });
  };

  const createMarker = (
    id: string,
    target: Element,
  ): { cleanup: () => void; marker: HTMLElement } => {
    const host = document.createElement('span');
    const markerSize = touchPrimary() ? 28 : 22;
    host.setAttribute(UI_ATTRIBUTE, 'marker');
    host.style.cssText = [
      'all:initial',
      'position:fixed',
      'z-index:2147483646',
      `width:${markerSize}px`,
      `height:${markerSize}px`,
      'pointer-events:auto',
    ].join(';');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const accent = commentAccent();
    style.textContent = `
      button {
        display:grid; width:22px; height:22px; place-items:center;
        border:2px solid ${accent.outline}; border-radius:50%; padding:0;
        background:${accent.color}; color:${accent.contrast};
        box-shadow:0 2px 8px rgba(0,0,0,.28); cursor:pointer; outline:0;
        transition:transform 100ms ease, background 100ms ease;
      }
      button:hover, button:focus-visible { background:${accent.hover}; transform:scale(1.12); }
      svg { width:11px; height:11px; fill:none; stroke:currentColor; stroke-width:2;
        stroke-linecap:round; stroke-linejoin:round; }
      @media (pointer:coarse) {
        button { width:28px; height:28px; }
        svg { width:13px; height:13px; }
      }
      @media (prefers-reduced-motion:reduce) { button { transition:none; } }
    `;
    const button = document.createElement('button');
    button.type = 'button';
    button.title = uiLabels.edit;
    button.setAttribute('aria-label', uiLabels.edit);
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const record = comments.get(id);
      if (record) openEditor(record.target, record);
    });
    shadow.append(style, button);
    document.documentElement.append(host);
    const fallback = { target, marker: host } as CommentRecord;
    const reposition = () => markerPosition(comments.get(id) ?? fallback);
    addEventListener('resize', reposition);
    addEventListener('orientationchange', reposition);
    addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reposition) : null;
    observer?.observe(target);
    return {
      marker: host,
      cleanup: () => {
        removeEventListener('resize', reposition);
        removeEventListener('orientationchange', reposition);
        removeEventListener('scroll', reposition, true);
        window.visualViewport?.removeEventListener('resize', reposition);
        window.visualViewport?.removeEventListener('scroll', reposition);
        observer?.disconnect();
      },
    };
  };

  const pauseSelection = () => {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('touchmove', onTouchMove, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    removeHighlighter();
    touchHint?.remove();
    touchHint = null;
    cursorStyle?.remove();
    cursorStyle = null;
    pickerFrameActive = false;
  };

  const resumeSelection = () => {
    if (!modeActive || editor) return;
    pauseSelection();
    cursorStyle = document.createElement('style');
    cursorStyle.setAttribute(UI_ATTRIBUTE, 'cursor');
    cursorStyle.textContent = `
      html, html * { cursor:crosshair !important; }
      html, body { touch-action:none !important; }
    `;
    document.documentElement.append(cursorStyle);
    if (touchPrimary()) {
      const hintColors =
        uiTheme === 'light'
          ? { background: '#ffffff', border: '#dfe3e1', color: '#171a18' }
          : { background: '#111313', border: '#272a2a', color: '#f3f5f4' };
      touchHint = document.createElement('div');
      touchHint.setAttribute(UI_ATTRIBUTE, 'hint');
      touchHint.textContent = uiLabels.touchHint;
      touchHint.style.cssText = [
        'all:initial',
        'position:fixed',
        'z-index:2147483646',
        'left:50%',
        'top:max(12px,env(safe-area-inset-top))',
        'transform:translateX(-50%)',
        'max-width:calc(100vw - 32px)',
        'padding:8px 12px',
        `border:1px solid ${hintColors.border}`,
        'border-radius:999px',
        `background:${hintColors.background}`,
        `color:${hintColors.color}`,
        'box-shadow:0 8px 24px rgba(0,0,0,.3)',
        'font:600 12px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'text-align:center',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'pointer-events:none',
      ].join(';');
      document.documentElement.append(touchHint);
    }
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
  };

  const finishEditor = () => {
    editor = null;
    if (modeActive && continuousMode) {
      resumeSelection();
      send({ type: 'panerelay.page-comment.picker-resumed' });
    } else if (modeActive) stopMode();
  };

  const openEditor = (target: Element, existing?: CommentRecord) => {
    editor?.cancel();
    pauseSelection();
    send({ type: 'panerelay.page-comment.picker-paused' });
    const originalText = existing?.originalText ?? target.textContent ?? '';
    const originalStyles = existing?.originalStyles ?? captureOriginalStyles(target);
    const originalEvidence = existing?.element ?? evidenceFor(target);
    const initialChanges = { ...(existing?.styleChanges ?? {}) };
    const host = document.createElement('div');
    host.setAttribute(UI_ATTRIBUTE, 'editor');
    host.style.cssText =
      'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const palette =
      uiTheme === 'light'
        ? {
            accent: '#087f46',
            accentContrast: '#ffffff',
            accentHover: '#066c3c',
            accentSoft: 'rgba(8,127,70,.12)',
            background: '#f7f8f7',
            border: '#dfe3e1',
            hover: '#e9ecea',
            muted: '#5f6863',
            raised: '#f1f3f2',
            shadow: '0 16px 40px rgba(23,26,24,.18)',
            surface: '#ffffff',
            text: '#171a18',
          }
        : {
            accent: '#35d07f',
            accentContrast: '#06150d',
            accentHover: '#56df96',
            accentSoft: 'rgba(53,208,127,.14)',
            background: '#0b0c0c',
            border: '#272a2a',
            hover: '#1d2020',
            muted: '#a2aaa6',
            raised: '#171919',
            shadow: '0 16px 40px rgba(0,0,0,.42)',
            surface: '#111313',
            text: '#f3f5f4',
          };
    style.textContent = `
      :host { color-scheme:${uiTheme}; --bg:${palette.surface}; --strong:${palette.raised};
        --toolbar:${palette.background}; --text:${palette.text}; --muted:${palette.muted};
        --border:${palette.border}; --hover:${palette.hover}; --accent:${palette.accent};
        --accent-hover:${palette.accentHover}; --accent-contrast:${palette.accentContrast};
        --accent-soft:${palette.accentSoft}; --shadow:${palette.shadow}; }
      *,*::before,*::after{box-sizing:border-box}
      .anchor{position:fixed;pointer-events:none;border:2px solid var(--accent);border-radius:4px;
        background:var(--accent-soft);transition:top 120ms ease,left 120ms ease,
        width 120ms ease,height 120ms ease}
      .card{position:fixed;display:flex;width:316px;max-width:calc(100vw - 16px);
        max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px);
        flex-direction:column;overflow:hidden;border:1px solid var(--border);border-radius:24px;
        background:var(--bg);color:var(--text);box-shadow:var(--shadow);
        pointer-events:auto;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        transition:border-radius 120ms ease,left 120ms ease,top 120ms ease}
      .card[data-expanded=true]{border-radius:14px}
      .composer{display:flex;min-height:48px;align-items:center;gap:5px;padding:7px 8px}
      button{font:inherit}
      .icon{display:grid;width:34px;height:34px;flex:none;place-items:center;border:0;
        border-radius:50%;background:transparent;color:var(--muted);cursor:pointer;outline:0}
      .icon:hover,.icon:focus-visible{background:var(--hover);color:var(--text)}
      .settings[aria-expanded=true]{background:var(--accent-soft);color:var(--accent)}
      svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;
        stroke-linecap:round;stroke-linejoin:round}
      textarea{display:block;flex:1;width:100%;min-width:0;height:28px;min-height:28px;
        max-height:76px;overflow:hidden;resize:none;border:0;outline:0;padding:4px 0;
        background:transparent;color:var(--text);font:13px/20px inherit;scrollbar-width:none}
      textarea::placeholder{color:var(--muted);opacity:.72}
      .confirm{background:var(--accent);color:var(--accent-contrast)}
      .confirm svg{stroke-width:2}
      .confirm:hover,.confirm:focus-visible{background:var(--accent-hover);
        color:var(--accent-contrast)}
      .confirm:disabled{background:var(--hover);color:var(--muted);opacity:.5;cursor:default}
      .expanded{display:none;min-height:0;flex-direction:column}
      .card[data-expanded=true] .expanded{display:flex}
      .card[data-expanded=true] .composer>.confirm{display:none}
      .element-bar{display:flex;min-height:34px;align-items:center;padding:0 13px;
        border-block:1px solid var(--border);background:var(--toolbar)}
      .element-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
      .grip{display:grid;grid-template-columns:repeat(2,3px);gap:3px;border:0;border-radius:5px;
        padding:4px;background:transparent;cursor:grab;opacity:.65;touch-action:none}
      .grip i{width:3px;height:3px;border-radius:50%;background:var(--muted)}
      .properties{min-height:0;max-height:min(260px,calc(100vh - 154px));
        max-height:min(260px,calc(100dvh - 154px));overflow:auto;padding:5px 10px 7px}
      label{display:grid;grid-template-columns:92px minmax(0,1fr);min-height:35px;
        align-items:center;gap:6px}
      label.group{margin-top:4px;padding-top:5px;border-top:1px solid var(--border)}
      label>span{overflow:hidden;color:var(--muted);font-size:11px;text-overflow:ellipsis;
        white-space:nowrap}
      input,select{width:100%;min-width:0;height:28px;border:1px solid var(--border);
        border-radius:7px;outline:0;background:var(--strong);color:var(--text);padding:0 8px;
        font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
      input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);
        outline-offset:1px}
      input[data-dirty=true],select[data-dirty=true]{border-color:var(--accent);
        background:var(--accent-soft)}
      .color-field{display:grid;grid-template-columns:30px minmax(0,1fr);gap:5px}
      .color-field[data-dirty=true]{border-radius:8px;background:var(--accent-soft)}
      .color-picker{width:30px;padding:3px;cursor:pointer}
      .color-picker::-webkit-color-swatch-wrapper{padding:0}
      .color-picker::-webkit-color-swatch{border:0;border-radius:4px}
      .footer{display:flex;min-height:46px;align-items:center;justify-content:space-between;
        padding:6px 8px 6px 10px;border-top:1px solid var(--border);background:var(--toolbar)}
      .cancel{min-height:28px;border:1px solid var(--border);border-radius:6px;padding:0 9px;
        background:transparent;color:var(--muted);cursor:pointer}
      .cancel:hover,.cancel:focus-visible{background:var(--hover);color:var(--text)}
      .footer .confirm{display:grid}
      @media (pointer:coarse) {
        .card{border-radius:18px}
        .card[data-expanded=true]{border-radius:12px}
        .composer{min-height:54px;padding:7px}
        .icon{width:40px;height:40px}
        textarea{min-height:36px;padding:7px 0;font-size:16px;line-height:22px}
        .element-bar{min-height:42px;padding-inline:12px}
        .grip{padding:8px}
        .properties{max-height:min(280px,calc(100dvh - 164px));padding:6px 8px 8px}
        label{grid-template-columns:82px minmax(0,1fr);min-height:44px;gap:8px}
        label>span{font-size:12px}
        input,select{height:36px;font-size:16px}
        .color-field{grid-template-columns:38px minmax(0,1fr);gap:7px}
        .color-picker{width:38px}
        .footer{min-height:52px;padding:6px 8px}
        .cancel{min-height:36px;padding-inline:12px}
      }
      @media (prefers-reduced-motion:reduce) {
        .anchor,.card{transition:none}
      }
    `;
    const anchor = document.createElement('div');
    anchor.className = 'anchor';
    const card = document.createElement('section');
    card.className = 'card';
    card.dataset.expanded = 'false';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', existing ? uiLabels.edit : uiLabels.add);
    const composer = document.createElement('div');
    composer.className = 'composer';
    const settings = document.createElement('button');
    settings.className = 'icon settings';
    settings.type = 'button';
    settings.title = uiLabels.style;
    settings.setAttribute('aria-label', uiLabels.style);
    settings.setAttribute('aria-expanded', 'false');
    settings.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>';
    const input = document.createElement('textarea');
    input.rows = 1;
    input.maxLength = 4_000;
    input.placeholder = uiLabels.placeholder;
    input.value = existing?.comment || '';
    const createConfirm = () => {
      const label = existing ? uiLabels.save : uiLabels.add;
      const button = document.createElement('button');
      button.className = 'icon confirm';
      button.type = 'button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
      return button;
    };
    const compactConfirm = createConfirm();
    composer.append(settings, input, compactConfirm);
    const expanded = document.createElement('div');
    expanded.className = 'expanded';
    const elementBar = document.createElement('div');
    elementBar.className = 'element-bar';
    const elementName = document.createElement('span');
    elementName.className = 'element-name';
    elementName.textContent = originalEvidence.tagName;
    elementName.title = originalEvidence.selector;
    const grip = document.createElement('button');
    grip.className = 'grip';
    grip.type = 'button';
    grip.setAttribute('aria-label', uiLabels.move);
    for (let index = 0; index < 6; index += 1) grip.append(document.createElement('i'));
    elementBar.append(elementName, grip);
    const properties = document.createElement('div');
    properties.className = 'properties';
    const readers = new Map<ChangeProperty, () => string>();
    const propertyInputs = new Map<ChangeProperty, HTMLInputElement | HTMLSelectElement>();
    const requested = new Set<ChangeProperty>(Object.keys(initialChanges) as ChangeProperty[]);
    const originalValues = new Map<ChangeProperty, string>();
    originalValues.set('textContent', originalText.trim());
    for (const property of STYLE_PROPERTIES) {
      originalValues.set(property, originalEvidence.computedStyle[property]?.trim() || '');
    }

    const currentChanges = (): StyleChanges =>
      Object.fromEntries(
        [...requested]
          .map(property => [property, readers.get(property)?.().trim() || ''])
          .filter((entry): entry is [ChangeProperty, string] => Boolean(entry[1])),
      );
    const preview = () => {
      restoreOriginal(target, originalText, originalStyles);
      applyChanges(target, currentChanges());
      schedulePosition();
    };
    const updateConfirm = () => {
      const disabled = !input.value.trim() && Object.keys(currentChanges()).length === 0;
      compactConfirm.disabled = disabled;
      footerConfirm.disabled = disabled;
    };
    const markDirty = (property: ChangeProperty) => {
      const control = propertyInputs.get(property);
      const colorField = control?.closest<HTMLElement>('.color-field');
      const value = readers.get(property)?.().trim() || '';
      if (value && value !== originalValues.get(property)) {
        requested.add(property);
        if (control) control.dataset.dirty = 'true';
        if (colorField) colorField.dataset.dirty = 'true';
      } else {
        requested.delete(property);
        control?.removeAttribute('data-dirty');
        colorField?.removeAttribute('data-dirty');
      }
      preview();
      updateConfirm();
    };
    const makeProperty = (property: ChangeProperty, group = false) => {
      const row = document.createElement('label');
      if (group) row.className = 'group';
      const label = document.createElement('span');
      label.textContent = propertyLabels[property];
      label.title = propertyLabels[property];
      let control: HTMLInputElement | HTMLSelectElement;
      if (property === 'fontWeight' || property === 'textAlign') {
        const select = document.createElement('select');
        const values =
          property === 'fontWeight'
            ? ['normal', '400', '500', '600', '700', 'bold']
            : ['start', 'left', 'center', 'right', 'justify'];
        const initial = initialChanges[property] || originalValues.get(property) || values[0]!;
        for (const value of [...new Set([initial, ...values])]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.append(option);
        }
        select.value = initial;
        control = select;
      } else {
        const text = document.createElement('input');
        text.type = property === 'opacity' ? 'number' : 'text';
        if (property === 'opacity') {
          text.min = '0';
          text.max = '1';
          text.step = '0.05';
        }
        text.value = initialChanges[property] || originalValues.get(property) || '';
        control = text;
      }
      control.setAttribute('aria-label', propertyLabels[property]);
      if (initialChanges[property]) control.dataset.dirty = 'true';
      readers.set(property, () => control.value);
      propertyInputs.set(property, control);
      control.addEventListener('input', () => markDirty(property));
      control.addEventListener('change', () => markDirty(property));
      if (
        control instanceof HTMLInputElement &&
        (property === 'color' || property === 'backgroundColor' || property === 'borderColor')
      ) {
        const colorField = document.createElement('div');
        colorField.className = 'color-field';
        if (initialChanges[property]) colorField.dataset.dirty = 'true';
        const picker = document.createElement('input');
        picker.className = 'color-picker';
        picker.type = 'color';
        picker.setAttribute('aria-label', `${propertyLabels[property]} picker`);
        picker.value = colorToHex(control.value) || (uiTheme === 'light' ? '#171a18' : '#f3f5f4');
        picker.addEventListener('input', () => {
          control.value = picker.value;
          markDirty(property);
        });
        control.addEventListener('input', () => {
          const nextColor = colorToHex(control.value);
          if (nextColor) picker.value = nextColor;
        });
        colorField.append(picker, control);
        row.append(label, colorField);
      } else {
        row.append(label, control);
      }
      properties.append(row);
    };
    makeProperty('textContent');
    for (const property of STYLE_PROPERTIES) {
      makeProperty(property, ['fontFamily', 'margin', 'borderRadius', 'width'].includes(property));
    }
    const footer = document.createElement('div');
    footer.className = 'footer';
    const cancel = document.createElement('button');
    cancel.className = 'cancel';
    cancel.type = 'button';
    cancel.textContent = uiLabels.cancel;
    const footerConfirm = createConfirm();
    footer.append(cancel, footerConfirm);
    expanded.append(elementBar, properties, footer);
    card.append(composer, expanded);
    shadow.append(style, anchor, card);
    document.documentElement.append(host);

    let destroyed = false;
    let positionFrame = 0;
    let manualPosition: { left: number; top: number } | null = null;
    let expandedState = false;
    const position = () => {
      positionFrame = 0;
      if (destroyed) return;
      const measured = target.isConnected ? target.getBoundingClientRect() : originalEvidence.rect;
      const left = finiteNumber(measured.left);
      const top = finiteNumber(measured.top);
      const measuredWidth = finiteNumber(measured.width);
      const measuredHeight = finiteNumber(measured.height);
      const rect = {
        left,
        top,
        width: measuredWidth,
        height: measuredHeight,
        right:
          'right' in measured
            ? finiteNumber(measured.right, left + measuredWidth)
            : left + measuredWidth,
        bottom:
          'bottom' in measured
            ? finiteNumber(measured.bottom, top + measuredHeight)
            : top + measuredHeight,
      };
      anchor.style.left = `${rect.left}px`;
      anchor.style.top = `${rect.top}px`;
      anchor.style.width = `${Math.max(0, rect.width)}px`;
      anchor.style.height = `${Math.max(0, rect.height)}px`;
      const margin = 8;
      const gap = 8;
      const viewport = viewportBounds();
      const viewportRight = viewport.left + viewport.width;
      const viewportBottom = viewport.top + viewport.height;
      const width = Math.min(316, Math.max(0, viewport.width - margin * 2));
      card.style.width = `${width}px`;
      card.style.maxHeight = `${Math.max(0, viewport.height - margin * 2)}px`;
      const cardRect = card.getBoundingClientRect();
      const height = Math.min(
        cardRect.height || (expandedState ? 430 : 48),
        Math.max(0, viewport.height - margin * 2),
      );
      const minimumLeft = viewport.left + margin;
      const maximumLeft = viewportRight - width - margin;
      const minimumTop = viewport.top + margin;
      const maximumTop = viewportBottom - height - margin;
      if (manualPosition) {
        manualPosition.left = clamp(manualPosition.left, minimumLeft, maximumLeft);
        manualPosition.top = clamp(manualPosition.top, minimumTop, maximumTop);
        card.style.left = `${manualPosition.left}px`;
        card.style.top = `${manualPosition.top}px`;
        return;
      }
      const candidates = [
        {
          left: rect.right + gap,
          top: rect.top,
          fits: rect.right + gap + width <= viewportRight - margin,
          space: viewportRight - rect.right,
        },
        {
          left: rect.left - width - gap,
          top: rect.top,
          fits: rect.left - width - gap >= viewport.left + margin,
          space: rect.left - viewport.left,
        },
        {
          left: rect.left,
          top: rect.bottom + gap,
          fits: rect.bottom + gap + height <= viewportBottom - margin,
          space: viewportBottom - rect.bottom,
        },
        {
          left: rect.left,
          top: rect.top - height - gap,
          fits: rect.top - height - gap >= viewport.top + margin,
          space: rect.top - viewport.top,
        },
      ];
      const chosen =
        candidates.find(candidate => candidate.fits) ??
        candidates.reduce((best, candidate) => (candidate.space > best.space ? candidate : best));
      card.style.left = `${clamp(chosen.left, minimumLeft, maximumLeft)}px`;
      card.style.top = `${clamp(chosen.top, minimumTop, maximumTop)}px`;
    };
    const schedulePosition = () => {
      if (!positionFrame && !destroyed) positionFrame = requestAnimationFrame(position);
    };
    const resizeInput = () => {
      input.style.height = '28px';
      const height = Math.max(28, input.scrollHeight);
      input.style.height = `${Math.min(height, 76)}px`;
      input.style.overflowY = height > 76 ? 'auto' : 'hidden';
      schedulePosition();
    };
    const destroy = (restore: boolean) => {
      if (destroyed) return;
      destroyed = true;
      if (restore) {
        restoreOriginal(target, originalText, originalStyles);
        if (existing) applyChanges(target, existing.styleChanges);
      }
      if (positionFrame) cancelAnimationFrame(positionFrame);
      removeEventListener('resize', schedulePosition);
      removeEventListener('orientationchange', schedulePosition);
      removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
      document.removeEventListener('pointerdown', outsidePointer, true);
      observer?.disconnect();
      host.remove();
    };
    const cancelEditor = () => {
      destroy(true);
      finishEditor();
    };
    const confirm = () => {
      const comment = bounded(input.value, 4_000);
      const styleChanges = currentChanges();
      if (!comment && Object.keys(styleChanges).length === 0) return;
      restoreOriginal(target, originalText, originalStyles);
      const element = evidenceFor(target);
      applyChanges(target, styleChanges);
      const id =
        existing?.id ||
        `page-comment-${FRAME_TOKEN.slice(-8)}-${Date.now().toString(36)}-${++sequence}`;
      const created = existing ? null : createMarker(id, target);
      const documents = commentDocumentEvidence();
      const record: CommentRecord = existing ?? {
        id,
        comment,
        target,
        element,
        page: documents.page,
        ...(documents.frame ? { frame: documents.frame } : {}),
        styleChanges,
        marker: created!.marker,
        markerCleanup: created!.cleanup,
        originalText,
        originalStyles,
      };
      record.comment = comment;
      record.element = element;
      record.page = documents.page;
      if (documents.frame) record.frame = documents.frame;
      else delete record.frame;
      record.styleChanges = styleChanges;
      record.target = target;
      comments.set(id, record);
      markerPosition(record);
      send({
        type: 'panerelay.page-comment.changed',
        comment: {
          id,
          comment,
          element,
          page: record.page,
          ...(record.frame ? { frame: record.frame } : {}),
          styleChanges,
        },
      });
      destroy(false);
      finishEditor();
    };
    const outsidePointer = (event: PointerEvent) => {
      const path = event.composedPath();
      if (path.includes(host) || expandedState) return;
      if (
        path.some(
          node => node instanceof Element && Boolean(node.closest(`[${UI_ATTRIBUTE}="marker"]`)),
        )
      ) {
        cancelEditor();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelEditor();
    };
    const beginDrag = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = card.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const move = (moveEvent: PointerEvent) => {
        manualPosition = {
          left: moveEvent.clientX - offsetX,
          top: moveEvent.clientY - offsetY,
        };
        position();
      };
      const end = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
      };
      try {
        grip.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer events may not have an active pointer.
      }
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    };
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(schedulePosition) : null;
    observer?.observe(target);
    observer?.observe(card);
    settings.addEventListener('click', () => {
      expandedState = !expandedState;
      card.dataset.expanded = String(expandedState);
      settings.setAttribute('aria-expanded', String(expandedState));
      schedulePosition();
    });
    input.addEventListener('input', () => {
      resizeInput();
      updateConfirm();
    });
    compactConfirm.addEventListener('click', confirm);
    footerConfirm.addEventListener('click', confirm);
    cancel.addEventListener('click', cancelEditor);
    grip.addEventListener('pointerdown', beginDrag);
    shadow.addEventListener('pointerdown', event => event.stopPropagation());
    shadow.addEventListener('click', event => event.stopPropagation());
    shadow.addEventListener('keydown', event => {
      const keyboard = event as KeyboardEvent;
      event.stopPropagation();
      if (keyboard.isComposing || keyboard.keyCode === 229) return;
      if (keyboard.key === 'Escape') {
        event.preventDefault();
        if (expandedState) {
          expandedState = false;
          card.dataset.expanded = 'false';
          settings.setAttribute('aria-expanded', 'false');
          schedulePosition();
        } else {
          cancelEditor();
        }
      } else if ((keyboard.metaKey || keyboard.ctrlKey) && keyboard.key === 'Enter') {
        event.preventDefault();
        confirm();
      } else if (keyboard.target === input && keyboard.key === 'Enter' && !keyboard.shiftKey) {
        event.preventDefault();
        confirm();
      }
    });
    document.addEventListener('pointerdown', outsidePointer, true);
    addEventListener('resize', schedulePosition);
    addEventListener('orientationchange', schedulePosition);
    addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    editor = {
      cancel: cancelEditor,
      destroy,
      ...(existing ? { commentId: existing.id } : {}),
    };
    position();
    resizeInput();
    updateConfirm();
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  };

  const targetAt = (clientX: number, clientY: number, fallback: EventTarget | null) =>
    document.elementFromPoint?.(clientX, clientY) ??
    (fallback instanceof Element ? fallback : null);

  const selectTarget = (target: Element, event: Event) => {
    if (isUiElement(target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const existing = [...comments.values()].find(comment => comment.target === target);
    openEditor(target, existing);
  };

  function onPointerMove(event: Event) {
    const target =
      event instanceof MouseEvent
        ? targetAt(event.clientX, event.clientY, event.target)
        : event.target;
    if (isUiElement(target) || !(target instanceof Element)) return;
    announceFrameActive();
    highlight(target);
  }

  function onPointerDown(event: Event) {
    if (isUiElement(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function onClick(event: Event) {
    const target =
      event instanceof MouseEvent
        ? targetAt(event.clientX, event.clientY, event.target)
        : event.target;
    if (isUiElement(target) || !(target instanceof Element)) return;
    announceFrameActive();
    selectTarget(target, event);
  }

  function onTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    const target = targetAt(touch.clientX, touch.clientY, event.target);
    if (target && !isUiElement(target)) {
      announceFrameActive();
      highlight(target);
    }
  }

  function onTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const target = targetAt(touch.clientX, touch.clientY, event.target) ?? highlighted;
    if (!target || isUiElement(target)) return;
    announceFrameActive();
    selectTarget(target, event);
  }

  function onContextMenu(event: Event) {
    if (isUiElement(event.target)) return;
    event.preventDefault();
    stopMode();
  }

  function onKeyDown(event: Event) {
    if (event instanceof KeyboardEvent && event.key === 'Escape') stopMode();
  }

  const startMode = (continuous: boolean, locale?: unknown, theme?: unknown, topPage?: unknown) => {
    if (theme === 'dark' || theme === 'light') uiTheme = theme;
    if (locale === 'zh-CN') {
      propertyLabels = CHINESE_PROPERTY_LABELS;
      uiLabels = {
        add: '添加评论',
        cancel: '取消',
        edit: '编辑页面评论',
        move: '移动批注面板',
        placeholder: '描述希望如何修改…',
        save: '保存评论',
        style: '样式修改',
        touchHint: '拖动高亮元素 · 松手确认选取',
      };
    } else {
      propertyLabels = ENGLISH_PROPERTY_LABELS;
      uiLabels = {
        add: 'Add comment',
        cancel: 'Cancel',
        edit: 'Edit page comment',
        move: 'Move annotation panel',
        placeholder: 'Describe what should change…',
        save: 'Save comment',
        style: 'Style changes',
        touchHint: 'Drag to highlight · Release to select',
      };
    }
    topPageEvidence = suppliedPageEvidence(topPage);
    continuousMode = continuous;
    modeActive = true;
    pickerFrameActive = false;
    resumeSelection();
    send({
      type: 'panerelay.page-comment.mode',
      active: true,
      continuous: continuousMode,
    });
  };

  const stopMode = (notify = true) => {
    if (!modeActive && !editor) return;
    modeActive = false;
    continuousMode = false;
    pauseSelection();
    const currentEditor = editor;
    editor = null;
    currentEditor?.destroy(true);
    if (notify) {
      send({ type: 'panerelay.page-comment.mode', active: false, continuous: false });
    }
  };

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const value = message as Record<string, unknown>;
    switch (value.type) {
      case 'panerelay.page-comments.start':
        startMode(value.continuous === true, value.locale, value.theme, value.topPage);
        break;
      case 'panerelay.page-comments.stop':
        stopMode(false);
        break;
      case 'panerelay.page-comments.pause':
        pauseSelection();
        break;
      case 'panerelay.page-comments.resume':
        resumeSelection();
        break;
      case 'panerelay.page-comments.frame-active':
        pickerFrameActive = value.frameToken === FRAME_TOKEN;
        if (!pickerFrameActive) removeHighlighter();
        break;
      case 'panerelay.page-comments.edit': {
        const record = typeof value.commentId === 'string' ? comments.get(value.commentId) : null;
        if (record) openEditor(record.target, record);
        break;
      }
      case 'panerelay.page-comments.remove':
        if (typeof value.commentId === 'string') removeComment(value.commentId);
        break;
      case 'panerelay.page-comments.clear':
        stopMode(false);
        for (const id of [...comments.keys()]) removeComment(id, false);
        break;
    }
  });

  addEventListener('scroll', positionHighlighter, true);
  addEventListener('resize', positionHighlighter);
  window.visualViewport?.addEventListener('resize', positionHighlighter);
  window.visualViewport?.addEventListener('scroll', positionHighlighter);
  addEventListener(
    'pagehide',
    () => {
      stopMode(false);
      for (const id of comments.keys()) {
        send({ type: 'panerelay.page-comment.removed', commentId: id });
      }
    },
    { once: true },
  );
  return true;
}
