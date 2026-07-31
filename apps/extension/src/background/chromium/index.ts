import { startCollaborationBackground } from '../shared/collaboration-runtime.js';
import { chromiumBrowserRuntime } from './browser-runtime.js';
import { ChromiumCdpAutomationAdapter } from './cdp-automation.js';

export const PANERELAY_EXTENSION_PLATFORM = 'chromium' as const;

const browserRuntime = chromiumBrowserRuntime();

startCollaborationBackground({
  automation: {
    transport: 'cdp',
    ready: browserRuntime.cdpRelay,
  },
  automationHostMessageTypes: ['cdp.target.request', 'cdp.attach', 'cdp.command', 'cdp.detach'],
  automationAdapter: new ChromiumCdpAutomationAdapter(browserRuntime),
  automationUnavailableMessage: 'Existing-tab CDP automation is unavailable in this browser.',
  browserRuntime,
});
