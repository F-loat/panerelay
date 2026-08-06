import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      getManifest: () => ({ version: '0.7.0.0', version_name: '0.7.0' }),
    },
  },
  writable: true,
});

afterEach(cleanup);
