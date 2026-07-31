import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import chromiumManifest from './manifest.json';
import firefoxManifest from './manifest.firefox.json';
import { platformOwnershipPlugin } from './platform-ownership.mjs';

const extensionDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox';
  const platform = firefox ? 'firefox' : 'chromium';
  const panelPlatformModule = fileURLToPath(
    new URL(`./src/pages/sidepanel/${platform}/platform.ts`, import.meta.url),
  );
  return {
    plugins: [
      tailwindcss(),
      crx({
        manifest: (firefox ? firefoxManifest : chromiumManifest) as ManifestV3Export,
        browser: firefox ? 'firefox' : 'chrome',
      }),
      platformOwnershipPlugin(extensionDirectory, platform),
    ],
    publicDir: 'public',
    resolve: {
      alias: {
        'virtual:panerelay-panel-platform': panelPlatformModule,
      },
    },
    server: {
      cors: {
        origin: [/chrome-extension:\/\//, /moz-extension:\/\//],
      },
    },
    build: {
      emptyOutDir: true,
      outDir: `dist/${platform}`,
      ...(firefox
        ? {
            rollupOptions: {
              input: {
                sidepanel: fileURLToPath(
                  new URL('./src/pages/sidepanel/index.html', import.meta.url),
                ),
              },
            },
          }
        : {}),
      sourcemap: true,
      target: firefox ? 'firefox128' : 'chrome116',
    },
  };
});
