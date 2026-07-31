#!/usr/bin/env node

import { installNativeHost, uninstallNativeHost } from './host-installation.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const options = {
  ...(argument('--user-data-dir') ? { userDataDirectory: argument('--user-data-dir') } : {}),
};

if (process.argv.includes('--uninstall')) {
  const result = await uninstallNativeHost(options);
  for (const manifestPath of result.manifestPaths) {
    process.stdout.write(`Removed ${manifestPath}\n`);
  }
  process.stdout.write(`Removed ${result.hostPath}\n`);
} else {
  const result = await installNativeHost({
    ...options,
    ...(argument('--extension-id') ? { extensionId: argument('--extension-id') } : {}),
    ...(argument('--firefox-extension-id')
      ? { firefoxExtensionId: argument('--firefox-extension-id') }
      : {}),
  });
  for (const manifestPath of result.manifestPaths) {
    process.stdout.write(`Installed ${manifestPath}\n`);
  }
  process.stdout.write(`Allowed extension: ${result.extensionId}\n`);
  process.stdout.write(`Allowed Firefox extension: ${result.firefoxExtensionId}\n`);
  process.stdout.write(`Installed host: ${result.hostPath}\n`);
  process.stdout.write(`Codex: ${result.codexPath || 'not found'}\n`);
  process.stdout.write(
    `Claude Code: ${result.claudePath || 'not found'}${
      result.claudeVersion ? ` (${result.claudeVersion})` : ''
    }\n`,
  );
  process.stdout.write(`agent-browser: ${result.agentBrowserPath || 'not found'}\n`);
  process.stdout.write(
    `Firefox automation: ${
      result.firefoxAutomationReady
        ? `${result.firefoxLauncherPath} (${result.firefoxPath}; ${result.geckodriverPath})`
        : 'not ready; install Firefox and geckodriver, then rerun setup'
    }\n`,
  );
}
