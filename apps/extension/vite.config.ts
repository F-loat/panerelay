import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    tailwindcss(),
    crx({
      manifest: manifest as ManifestV3Export,
      browser: 'chrome',
    }),
  ],
  publicDir: 'public',
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    emptyOutDir: true,
    modulePreload: false,
    outDir: 'dist',
    sourcemap: true,
    target: 'chrome116',
    rollupOptions: {
      input: {
        fetchPermission: resolve(import.meta.dirname, 'src/pages/fetch-permission/index.html'),
      },
    },
  },
});
