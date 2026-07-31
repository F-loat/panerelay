import { startCollaborationBackground } from '../shared/collaboration-runtime.js';
import { firefoxBrowserRuntime } from './browser-runtime.js';
import { FirefoxWebDriverAutomationAdapter } from './webdriver-rendezvous.js';

export const PANERELAY_EXTENSION_PLATFORM = 'firefox' as const;

startCollaborationBackground({
  automation: { transport: 'webdriver', ready: false },
  automationHostMessageTypes: ['webdriver.readiness'],
  automationAdapter: new FirefoxWebDriverAutomationAdapter(),
  automationUnavailableMessage:
    'Firefox automation needs a managed Panerelay Firefox session and a compatible agent-browser WebDriver Provider.',
  browserRuntime: firefoxBrowserRuntime(),
});
