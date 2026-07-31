import { relative, sep } from 'node:path';

const PRIVATE_ROOTS = {
  chromium: ['src/background/chromium/', 'src/pages/sidepanel/chromium/'],
  firefox: ['src/background/firefox/', 'src/pages/sidepanel/firefox/'],
};

const FORBIDDEN_BUNDLE_TOKENS = {
  chromium: [
    '__panerelayFirefoxWebDriverRendezvous',
    'panerelay.webdriver.rendezvous',
    'webdriver.readiness',
    'webdriver.rendezvous.result',
    'webdriver.target.invalidated',
  ],
  firefox: ['cdp.attach', 'cdp.command', 'cdp.detach', 'cdp.target.request', 'chrome.debugger'],
};

function normalizePath(value) {
  return value.split(sep).join('/');
}

export function platformOwnershipPlugin(extensionDirectory, platform) {
  const forbiddenPlatform = platform === 'firefox' ? 'chromium' : 'firefox';
  const forbiddenRoots = PRIVATE_ROOTS[forbiddenPlatform];
  return {
    name: 'panerelay-platform-ownership',
    generateBundle(_options, bundle) {
      const localModules = new Set();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const moduleId of Object.keys(output.modules)) {
          if (!moduleId.startsWith(extensionDirectory)) continue;
          const modulePath = normalizePath(relative(extensionDirectory, moduleId));
          localModules.add(modulePath);
        }
      }
      const forbiddenModules = [...localModules].filter(modulePath =>
        forbiddenRoots.some(root => modulePath.startsWith(root)),
      );
      if (forbiddenModules.length > 0) {
        this.error(
          `${platform} Extension graph contains ${forbiddenPlatform}-private modules: ${forbiddenModules.join(', ')}`,
        );
      }
      const forbiddenTokens = FORBIDDEN_BUNDLE_TOKENS[platform];
      const forbiddenTokenMatches = forbiddenTokens.filter(token =>
        Object.values(bundle).some(
          output => output.type === 'chunk' && output.code.includes(token),
        ),
      );
      if (forbiddenTokenMatches.length > 0) {
        this.error(
          `${platform} Extension graph contains ${forbiddenPlatform}-private bundle tokens: ${forbiddenTokenMatches.join(', ')}`,
        );
      }
      this.emitFile({
        type: 'asset',
        fileName: 'panerelay-platform-modules.json',
        source: `${JSON.stringify(
          {
            schema: 1,
            platform,
            marker: `panerelay-extension-${platform}`,
            privateRoots: PRIVATE_ROOTS[platform],
            forbiddenRoots,
            forbiddenTokens,
            forbiddenTokenMatches,
            modules: [...localModules].sort(),
          },
          null,
          2,
        )}\n`,
      });
    },
  };
}
