#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import {
  CLI_ADAPTER_MAX_MESSAGE_BYTES,
  parseCliAdapterRequest,
  serializeCliAdapterMessage,
} from '@panerelay/protocol';
import { handleBrowserUseAdapterRequest } from './adapter.js';
export {
  PANERELAY_BROWSER_USE_GATEWAY_URL,
  browserUseEnvironmentPath,
  setBrowserUseEnvironmentMode,
} from './environment.js';

async function adapterVersion(): Promise<string> {
  const value = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: unknown;
  };
  if (typeof value.version !== 'string') throw new Error('Adapter package version is invalid');
  return value.version;
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > CLI_ADAPTER_MAX_MESSAGE_BYTES) throw new Error('Adapter request is too large');
    chunks.push(buffer);
  }
  const request = parseCliAdapterRequest(Buffer.concat(chunks).toString('utf8').trim());
  const response = await handleBrowserUseAdapterRequest(request, {
    adapterVersion: await adapterVersion(),
  });
  process.stdout.write(serializeCliAdapterMessage(response));
}

await main();
