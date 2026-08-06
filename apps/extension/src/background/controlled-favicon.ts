import type { AutomationEngineId } from '@panerelay/protocol';

const CONTROL_BADGE =
  '<circle cx="104" cy="104" r="21" fill="#16A34A" stroke="#FFFFFF" stroke-width="6"/>';

export function createAgentBrowserControlledFaviconDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" data-control-engine="agent-browser">
  <rect width="128" height="128" rx="28" fill="#000000"/>
  <path d="M64 31L96 88H32L64 31Z" fill="#FFFFFF"/>
  ${CONTROL_BADGE}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL =
  createAgentBrowserControlledFaviconDataUrl();

/** Browser Use primary mark, kept in its upstream view box: https://browser-use.com/logo-primary.svg */
export function createBrowserUseControlledFaviconDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" data-control-engine="browser-use">
  <rect width="128" height="128" rx="28" fill="#000000"/>
  <svg x="12" y="12" width="104" height="104" viewBox="0 0 100 100" overflow="hidden" color="#FFFFFF">
    <path d="M97.8916 39.0448C82.6177 33.1997 95.2199 10.8169 74.212 11.3849C48.5413 12.0793 8.31528 52.4518 12.4236 78.6851C14.4652 91.6755 24.6096 86.2218 29.3732 88.1154C32.5364 89.3652 36.2792 95.0083 40.3245 95.9047C22.4293 106.193 -0.556809 96.397 0.0102912 74.3423C0.829435 41.86 47.7474 -5.25386 81.1937 0.477571C99.8702 3.68414 102.189 23.5422 97.8916 39.0448Z" fill="currentColor"/>
    <path d="M24.8115 57.7541L39.6068 71.7166C49.0332 80.1875 74.061 94.9706 85.403 84.9469C98.774 73.1306 70.495 32.3162 57.4769 25.802L68.9069 20.6639C86.7138 33.6796 113.783 75.9836 91.7294 94.4025C77.5014 106.282 54.5655 96.2204 41.0811 87.3707C30.8103 80.6294 15.9647 70.9591 24.8115 57.7415V57.7541Z" fill="currentColor"/>
    <path d="M40.3373 4.75723C35.5485 4.88347 31.8055 11.1199 28.2895 12.2182C25.1642 13.1903 20.8414 10.5266 16.1408 14.0487C11.0495 17.8613 12.7891 36.0655 3.02233 40.5976C-2.98893 22.9362 0.75354 1.8789 22.4672 0.0736228C24.1433 -0.0652445 42.7822 1.17195 40.3373 4.74463V4.75723Z" fill="currentColor"/>
    <path d="M76.1025 57.754C84.1175 71.0348 69.5871 86.2092 57.489 74.1025L76.1025 57.754Z" fill="currentColor"/>
  </svg>
  ${CONTROL_BADGE}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const BROWSER_USE_CONTROLLED_FAVICON_DATA_URL = createBrowserUseControlledFaviconDataUrl();

export function createPlaywrightControlledFaviconDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" data-control-engine="playwright">
  <g stroke="#142631" stroke-width="2.4" stroke-linejoin="round">
    <path d="M20 45c8 3 19 4 31 0l21-9c-2 16-8 34-18 43-10 9-25 8-33-1-6-7-8-19-8-33Z" fill="#E85A51"/>
    <path d="M31 58c8 3 15 2 22-1-2 8-7 12-14 12-4 0-7-4-8-11Z" fill="#142631" stroke="none"/>
    <path d="M44 78c5-7 12-10 20-9-3 7-8 11-15 13Z" fill="#142631" stroke="none"/>
    <path d="M57 14c10 10 23 18 38 22 10 3 20 4 29 2 1 19-4 42-17 55-13 14-35 14-49 3-12-10-18-27-17-45 1-17 6-30 16-37Z" fill="#2EAD33"/>
    <path d="M63 43c8-2 14 1 19 8-7 0-13 1-19 5-1-5-1-9 0-13Z" fill="#142631" stroke="none"/>
    <path d="M89 55c8-2 14 1 19 7-7 0-13 2-19 5-1-4-1-8 0-12Z" fill="#142631" stroke="none"/>
    <path d="M67 72c11 5 22 8 34 9-5 10-15 14-25 11-7-2-11-8-9-20Z" fill="#142631"/>
  </g>
  ${CONTROL_BADGE}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const PLAYWRIGHT_CONTROLLED_FAVICON_DATA_URL = createPlaywrightControlledFaviconDataUrl();

export function controlledFaviconDataUrl(engine: AutomationEngineId): string {
  if (engine === 'browser-use') return BROWSER_USE_CONTROLLED_FAVICON_DATA_URL;
  if (engine === 'playwright') return PLAYWRIGHT_CONTROLLED_FAVICON_DATA_URL;
  return AGENT_BROWSER_CONTROLLED_FAVICON_DATA_URL;
}

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

/** Runs inside the page and replaces only an existing Panerelay controlled favicon. */
export function replaceControlledFavicon(iconHref: string): boolean {
  if (window !== window.top) return false;
  const marked = window as ControlledFaviconWindow;
  const state = marked.__panerelayControlledFavicon__;
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[data-panerelay-controlled-favicon]'),
  );
  if (!state || links.length === 0) return false;
  state.iconHref = iconHref;
  for (const link of links) link.href = iconHref;
  return true;
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

export async function applyControlledFavicon(
  tabId: number,
  engine: AutomationEngineId,
): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: overrideControlledFavicon,
      args: [controlledFaviconDataUrl(engine)],
      injectImmediately: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function replaceControlledFaviconEngine(
  tabId: number,
  engine: AutomationEngineId,
): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: replaceControlledFavicon,
      args: [controlledFaviconDataUrl(engine)],
      injectImmediately: true,
    });
    return results.some(result => result.result === true);
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
