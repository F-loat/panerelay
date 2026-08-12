import { websiteAccentPalette, type WebsiteAccentPalette } from '../shared/appearance.js';

export const WEBSITE_APPEARANCE_PORT_NAME = 'panerelay.website-appearance.v1';
export const WEBSITE_APPEARANCE_MESSAGE_TYPE = 'panerelay.website-appearance.snapshot';

const OFFICIAL_WEBSITE_ORIGIN = 'https://f-loat.github.io';
const OFFICIAL_WEBSITE_PATH = '/panerelay/';

export interface WebsiteAppearanceMessage {
  type: typeof WEBSITE_APPEARANCE_MESSAGE_TYPE;
  version: 1;
  accent: WebsiteAccentPalette;
}

interface PortEvent<Listener extends (...args: never[]) => void> {
  addListener(listener: Listener): void;
  removeListener(listener: Listener): void;
}

export interface WebsiteAppearancePort {
  name: string;
  sender?: {
    origin?: string;
    url?: string;
  };
  postMessage(message: WebsiteAppearanceMessage): void;
  disconnect(): void;
  onDisconnect: PortEvent<() => void>;
}

export function websiteAppearanceMessage(accentColor: unknown): WebsiteAppearanceMessage {
  return {
    type: WEBSITE_APPEARANCE_MESSAGE_TYPE,
    version: 1,
    accent: websiteAccentPalette(accentColor),
  };
}

export function isOfficialWebsiteAppearancePort(port: WebsiteAppearancePort): boolean {
  if (port.name !== WEBSITE_APPEARANCE_PORT_NAME || typeof port.sender?.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(port.sender.url);
    return (
      url.origin === OFFICIAL_WEBSITE_ORIGIN &&
      (port.sender.origin === undefined || port.sender.origin === OFFICIAL_WEBSITE_ORIGIN) &&
      (url.pathname === OFFICIAL_WEBSITE_PATH.slice(0, -1) ||
        url.pathname.startsWith(OFFICIAL_WEBSITE_PATH))
    );
  } catch {
    return false;
  }
}

export class WebsiteAppearancePublisher {
  readonly #ports = new Map<WebsiteAppearancePort, () => void>();
  readonly #readAccentColor: () => Promise<unknown>;
  #revision = 0;

  constructor(readAccentColor: () => Promise<unknown>) {
    this.#readAccentColor = readAccentColor;
  }

  connect(port: WebsiteAppearancePort): void {
    if (!isOfficialWebsiteAppearancePort(port)) {
      this.#disconnect(port);
      return;
    }

    const onDisconnect = () => this.#forget(port);
    this.#ports.set(port, onDisconnect);
    port.onDisconnect.addListener(onDisconnect);
    void this.#publishInitial(port, this.#revision);
  }

  publishAccent(accentColor: unknown): void {
    this.#revision += 1;
    const message = websiteAppearanceMessage(accentColor);
    for (const port of this.#ports.keys()) {
      this.#post(port, message);
    }
  }

  get connectionCount(): number {
    return this.#ports.size;
  }

  async #publishInitial(port: WebsiteAppearancePort, revision: number): Promise<void> {
    try {
      const accentColor = await this.#readAccentColor();
      if (revision !== this.#revision || !this.#ports.has(port)) return;
      this.#post(port, websiteAppearanceMessage(accentColor));
    } catch {
      this.#disconnect(port);
    }
  }

  #post(port: WebsiteAppearancePort, message: WebsiteAppearanceMessage): void {
    try {
      port.postMessage(message);
    } catch {
      this.#disconnect(port);
    }
  }

  #forget(port: WebsiteAppearancePort): void {
    const listener = this.#ports.get(port);
    if (!listener) return;
    this.#ports.delete(port);
    port.onDisconnect.removeListener(listener);
  }

  #disconnect(port: WebsiteAppearancePort): void {
    this.#forget(port);
    try {
      port.disconnect();
    } catch {
      // The browser may already have disconnected an invalid or failed port.
    }
  }
}
