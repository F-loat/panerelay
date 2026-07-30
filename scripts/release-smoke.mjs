#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { smokePackedConsumer } from './release-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

await smokePackedConsumer({ root });
console.log(`Packed consumer verified on ${process.platform} with ${process.version}.`);
