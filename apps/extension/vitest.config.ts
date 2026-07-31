import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.component.test.tsx',
      'src/content/page-comments-runtime.test.ts',
      'src/pages/sidepanel/page-comment-context.test.ts',
      'src/pages/sidepanel/sidepanel-images.test.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
});
