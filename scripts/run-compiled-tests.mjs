#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function findTests(directory) {
  const tests = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) tests.push(...(await findTests(path)));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) tests.push(path);
  }
  return tests;
}

const directory = resolve(process.argv[2] ?? 'dist');
const tests = (await findTests(directory)).sort();
if (tests.length === 0) {
  throw new Error(`No compiled test files found in ${directory}`);
}

await new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', code => {
    if (code === 0) resolvePromise();
    else reject(new Error(`Compiled tests exited with code ${code ?? 'unknown'}`));
  });
});
