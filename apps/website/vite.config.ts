import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const websiteRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(websiteRoot, 'index.html'),
        compare: resolve(websiteRoot, 'compare/index.html'),
        compareZhCn: resolve(websiteRoot, 'zh-CN/compare/index.html'),
      },
    },
  },
});
