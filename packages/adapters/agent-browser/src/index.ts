#!/usr/bin/env node

import { handlePluginRequest } from './plugin.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
}

let input: unknown;
try {
  input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
} catch {
  input = {};
}

const response = await handlePluginRequest(input as Record<string, unknown>);
process.stdout.write(JSON.stringify(response));
