import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.component.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
