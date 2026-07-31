import type { BrowserFamily } from '@panerelay/protocol';

export interface BrowserRuntime {
  browserFamily: BrowserFamily;
  browserName: string;
  cdpRelay: boolean;
}

export interface BrowserRuntimeProbe {
  debuggerAvailable?: boolean;
  platform?: string;
  userAgent?: string;
}

export function detectBrowserRuntime(probe: BrowserRuntimeProbe = {}): BrowserRuntime {
  const runtime = globalThis as typeof globalThis & {
    chrome?: typeof chrome;
    navigator?: Navigator;
  };
  const chromeApi = runtime.chrome;
  const navigatorApi = runtime.navigator;
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
  const browserLabel =
    browserFamily === 'edge'
      ? 'Microsoft Edge'
      : browserFamily === 'chromium'
        ? 'Chromium'
        : browserFamily === 'chrome'
          ? 'Chrome'
          : 'Browser';

  return {
    browserFamily,
    browserName: `${browserLabel} on ${probe.platform ?? navigatorApi?.platform ?? 'this device'}`,
    cdpRelay: debuggerAvailable,
  };
}
