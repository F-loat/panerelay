export interface PanelPlatform {
  automationTransport: 'cdp' | 'webdriver';
  browser: 'chromium' | 'firefox';
  surface: 'side-panel' | 'sidebar';
}
