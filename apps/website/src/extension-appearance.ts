const PANERELAY_EXTENSION_ID = 'panplnkjlkoceaonlmpdekjphgmbggmi';
const WEBSITE_APPEARANCE_PORT_NAME = 'panerelay.website-appearance.v1';
const WEBSITE_APPEARANCE_MESSAGE_TYPE = 'panerelay.website-appearance.snapshot';
const RECONNECT_DELAY_MS = 5_000;
const HEX_COLOR = /^#[\da-f]{6}$/;

interface RuntimeEvent<Listener extends (...args: never[]) => void> {
  addListener(listener: Listener): void;
  removeListener(listener: Listener): void;
}

interface AppearancePort {
  onMessage: RuntimeEvent<(message: unknown) => void>;
  onDisconnect: RuntimeEvent<() => void>;
  disconnect(): void;
}

interface ExternalRuntime {
  lastError?: unknown;
  connect(extensionId: string, connectInfo: { name: string }): AppearancePort;
}

interface StyleTarget {
  setProperty(name: string, value: string): void;
}

export interface WebsiteAppearanceEnvironment {
  runtime: ExternalRuntime | undefined;
  style: StyleTarget;
  applyLogoAccent?(color: string): void;
  setTimer(callback: () => void, delay: number): number;
  clearTimer(timer: number): void;
  addPageHideListener(listener: (persisted: boolean) => void): void;
  removePageHideListener(listener: (persisted: boolean) => void): void;
}

interface WebsiteAccentPalette {
  primary: string;
  soft: string;
  dark: string;
}

function defaultEnvironment(): WebsiteAppearanceEnvironment {
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: ExternalRuntime } })
    .chrome?.runtime;
  const pageHideListeners = new Map<
    (persisted: boolean) => void,
    (event: PageTransitionEvent) => void
  >();
  const logoImages = [
    ...document.querySelectorAll<HTMLImageElement>('img[src$="panerelay-icon.svg"]'),
  ];
  const iconLinks = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];

  return {
    runtime,
    style: document.documentElement.style,
    applyLogoAccent(color) {
      const source = websiteLogoDataUrl(color);
      for (const image of logoImages) image.src = source;
      for (const link of iconLinks) link.href = source;
    },
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: timer => window.clearTimeout(timer),
    addPageHideListener(listener) {
      const browserListener = (event: PageTransitionEvent) => listener(event.persisted);
      pageHideListeners.set(listener, browserListener);
      window.addEventListener('pagehide', browserListener);
    },
    removePageHideListener(listener) {
      const browserListener = pageHideListeners.get(listener);
      if (!browserListener) return;
      pageHideListeners.delete(listener);
      window.removeEventListener('pagehide', browserListener);
    },
  };
}

export function websiteLogoDataUrl(accentColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111513"/><path d="M216 108H120V404H216" fill="none" stroke="#F4F7F5" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/><path d="M296 108H392V404H296" fill="none" stroke="#F4F7F5" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/><path d="M202 328L310 220" fill="none" stroke="${accentColor}" stroke-width="42" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function parsePalette(message: unknown): WebsiteAccentPalette | null {
  if (!message || typeof message !== 'object') return null;
  const candidate = message as Record<string, unknown>;
  if (
    candidate.type !== WEBSITE_APPEARANCE_MESSAGE_TYPE ||
    candidate.version !== 1 ||
    !candidate.accent ||
    typeof candidate.accent !== 'object'
  ) {
    return null;
  }

  const accent = candidate.accent as Record<string, unknown>;
  if (
    typeof accent.primary !== 'string' ||
    typeof accent.soft !== 'string' ||
    typeof accent.dark !== 'string' ||
    !HEX_COLOR.test(accent.primary) ||
    !HEX_COLOR.test(accent.soft) ||
    !HEX_COLOR.test(accent.dark)
  ) {
    return null;
  }

  return { primary: accent.primary, soft: accent.soft, dark: accent.dark };
}

function colorChannels(color: string): string {
  return [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)]
    .map(channel => Number.parseInt(channel, 16))
    .join(' ');
}

function applyPalette(
  environment: WebsiteAppearanceEnvironment,
  palette: WebsiteAccentPalette,
): void {
  for (const [name, color] of [
    ['--green', palette.primary],
    ['--green-soft', palette.soft],
    ['--green-dark', palette.dark],
  ] as const) {
    environment.style.setProperty(name, color);
    environment.style.setProperty(`${name}-rgb`, colorChannels(color));
  }
  environment.applyLogoAccent?.(palette.primary);
}

export function initializeWebsiteAppearance(
  environment: WebsiteAppearanceEnvironment = defaultEnvironment(),
): () => void {
  if (!environment.runtime) return () => undefined;

  const runtime = environment.runtime;
  let disposed = false;
  let currentPort: AppearancePort | null = null;
  let reconnectTimer: number | null = null;

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) return;
    reconnectTimer = environment.setTimer(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  };

  const connect = () => {
    if (disposed || currentPort) return;

    let port: AppearancePort;
    try {
      port = runtime.connect(PANERELAY_EXTENSION_ID, { name: WEBSITE_APPEARANCE_PORT_NAME });
    } catch {
      scheduleReconnect();
      return;
    }

    currentPort = port;
    const onMessage = (message: unknown) => {
      const palette = parsePalette(message);
      if (palette) applyPalette(environment, palette);
    };
    const onDisconnect = () => {
      void runtime.lastError;
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
      if (currentPort === port) currentPort = null;
      scheduleReconnect();
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
  };

  const onPageHide = (persisted: boolean) => {
    if (!persisted) dispose();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    environment.removePageHideListener(onPageHide);
    if (reconnectTimer !== null) {
      environment.clearTimer(reconnectTimer);
      reconnectTimer = null;
    }
    const port = currentPort;
    currentPort = null;
    if (port) {
      try {
        port.disconnect();
      } catch {
        // The browser may already have disconnected the optional appearance channel.
      }
    }
  };

  environment.addPageHideListener(onPageHide);
  connect();
  return dispose;
}
