import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'virtual:panerelay-panel-platform': fileURLToPath(
        new URL('./src/pages/sidepanel/chromium/platform.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.component.test.tsx',
      'src/content/page-comments-runtime.test.ts',
      'src/pages/sidepanel/page-comment-context.test.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
});
