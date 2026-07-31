import type { BrowserRuntime } from '../../shared/browser-runtime.js';

export function firefoxBrowserRuntime(): BrowserRuntime {
  return {
    actionBadge: false,
    browserFamily: 'firefox',
    browserName: `Firefox on ${navigator.platform || 'this device'}`,
    cdpRelay: false,
    chromiumSidePanel: false,
    firefoxSidebar: true,
  };
}
