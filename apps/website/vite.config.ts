import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
// @ts-expect-error -- plain ESM build script without type declarations.
import { generateLocalePages } from './scripts/localize.mjs';

const websiteRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(async () => {
  await generateLocalePages();

  return {
    base: './',
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          main: resolve(websiteRoot, 'index.html'),
          mainZhCn: resolve(websiteRoot, 'zh-CN/index.html'),
          compare: resolve(websiteRoot, 'compare/index.html'),
          compareZhCn: resolve(websiteRoot, 'zh-CN/compare/index.html'),
        },
      },
    },
  };
});
