#!/usr/bin/env node

const { basename, dirname } = require('node:path');

const version = basename(dirname(__filename));
let buffered = Buffer.alloc(0);

function encode(message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

process.stdin.on('data', chunk => {
  buffered = buffered.length === 0 ? chunk : Buffer.concat([buffered, chunk]);
  while (buffered.length >= 4) {
    const length = buffered.readUInt32LE(0);
    if (buffered.length < length + 4) return;
    const payload = JSON.parse(buffered.subarray(4, length + 4).toString('utf8'));
    buffered = buffered.subarray(length + 4);
    process.stdout.write(
      encode({
        actor: process.env.PANERELAY_SPIKE_BROWSER,
        requestId: payload.requestId,
        version,
      }),
    );
  }
});
