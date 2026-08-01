import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
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
  },
});
