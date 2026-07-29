import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
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
    outDir: 'dist',
    sourcemap: true,
    target: 'chrome116',
  },
});
