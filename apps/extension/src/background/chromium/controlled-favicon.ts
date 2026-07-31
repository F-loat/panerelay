export function createAgentBrowserControlledFaviconDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" data-control-engine="agent-browser">
  <rect width="128" height="128" rx="28" fill="#000000"/>
  <path d="M64 31L96 88H32L64 31Z" fill="#FFFFFF"/>
  <circle cx="104" cy="104" r="21" fill="#FFFFFF"/>
  <circle cx="104" cy="104" r="16" fill="#20E68F"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL =
  createAgentBrowserControlledFaviconDataUrl();

interface ControlledFaviconState {
  originalIcons: HTMLLinkElement[];
  capturedIcons: boolean;
  iconHref: string;
  observer?: MutationObserver;
  onReady?: () => void;
}

interface ControlledFaviconWindow extends Window {
  __panerelayControlledFavicon__?: ControlledFaviconState;
}

/**
 * Runs inside the authorized page's isolated world. DOM nodes are shared across worlds, while the
 * guard state stays inaccessible to page scripts.
 */
export function overrideControlledFavicon(iconHref: string): void {
  if (window !== window.top) return;
  const controlledFaviconAttribute = 'data-panerelay-controlled-favicon';
  const marked = window as ControlledFaviconWindow;
  const existing = marked.__panerelayControlledFavicon__;
  if (existing) {
    existing.iconHref = iconHref;
    document
      .querySelectorAll<HTMLLinkElement>('link[data-panerelay-controlled-favicon]')
      .forEach(link => (link.href = iconHref));
    return;
  }

  const state: ControlledFaviconState = {
    originalIcons: [],
    capturedIcons: false,
    iconHref,
  };
  marked.__panerelayControlledFavicon__ = state;

  const apply = () => {
    const head = document.head;
    if (!head) return;
    const pageIcons = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"]:not([data-panerelay-controlled-favicon])',
      ),
    );
    if (!state.capturedIcons && pageIcons.length > 0) {
      state.originalIcons = pageIcons.map(link => link.cloneNode(true) as HTMLLinkElement);
      state.capturedIcons = true;
    }
    for (const link of pageIcons) link.remove();
    if (!head.querySelector('link[data-panerelay-controlled-favicon]')) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = state.iconHref;
      link.setAttribute(controlledFaviconAttribute, '');
      head.appendChild(link);
    }
  };

  const start = () => {
    apply();
    if (!document.head) return;
    state.observer = new MutationObserver(apply);
    state.observer.observe(document.head, { childList: true, subtree: true });
  };

  if (document.head) {
    start();
  } else {
    state.onReady = start;
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
}

/** Runs inside the page and restores the favicon nodes captured before control began. */
export function restoreControlledFavicon(): void {
  if (window !== window.top) return;
  const marked = window as ControlledFaviconWindow;
  const state = marked.__panerelayControlledFavicon__;
  state?.observer?.disconnect();
  if (state?.onReady) {
    document.removeEventListener('DOMContentLoaded', state.onReady);
  }
  document
    .querySelectorAll<HTMLLinkElement>('link[data-panerelay-controlled-favicon]')
    .forEach(link => link.remove());
  if (state && document.head) {
    for (const icon of state.originalIcons) document.head.appendChild(icon);
  }
  delete marked.__panerelayControlledFavicon__;
}

export async function applyControlledFavicon(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: overrideControlledFavicon,
      args: [AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL],
      injectImmediately: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseControlledFavicon(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: restoreControlledFavicon,
      injectImmediately: true,
    });
    return true;
  } catch {
    return false;
  }
}
