import type { BrowserFamily } from '@panerelay/protocol';
import type { BrowserRuntime } from '../../shared/browser-runtime.js';

export interface ChromiumRuntimeProbe {
  actionAvailable?: boolean;
  debuggerAvailable?: boolean;
  platform?: string;
  sidePanelAvailable?: boolean;
  userAgent?: string;
}

export function chromiumBrowserRuntime(probe: ChromiumRuntimeProbe = {}): BrowserRuntime {
  const globalBrowser = globalThis as typeof globalThis & {
    chrome?: typeof chrome;
    navigator?: Navigator;
  };
  const chromeApi = globalBrowser.chrome;
  const navigatorApi = globalBrowser.navigator;
  const userAgent = probe.userAgent ?? navigatorApi?.userAgent ?? '';
  const browserFamily: BrowserFamily = /Edg(?:e|A|iOS)?\//i.test(userAgent)
    ? 'edge'
    : /Chromium\//i.test(userAgent)
      ? 'chromium'
      : /Chrome\//i.test(userAgent)
        ? 'chrome'
        : 'unknown';
  const debuggerAvailable =
    probe.debuggerAvailable ??
    (typeof chromeApi?.debugger?.attach === 'function' &&
      typeof chromeApi.debugger?.sendCommand === 'function');
  const sidePanelAvailable =
    probe.sidePanelAvailable ?? typeof chromeApi?.sidePanel?.setPanelBehavior === 'function';
  const actionAvailable =
    probe.actionAvailable ?? typeof chromeApi?.action?.setBadgeText === 'function';
  const browserLabel =
    browserFamily === 'edge'
      ? 'Microsoft Edge'
      : browserFamily === 'chromium'
        ? 'Chromium'
        : browserFamily === 'chrome'
          ? 'Chrome'
          : 'Browser';
  return {
    actionBadge: actionAvailable,
    browserFamily,
    browserName: `${browserLabel} on ${probe.platform ?? navigatorApi?.platform ?? 'this device'}`,
    cdpRelay: debuggerAvailable,
    chromiumSidePanel: sidePanelAvailable,
    firefoxSidebar: false,
  };
}
