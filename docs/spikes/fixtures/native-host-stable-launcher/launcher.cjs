#!/usr/bin/env node

const { lstatSync, readFileSync } = require('node:fs');
const { dirname, join, resolve, sep } = require('node:path');
const { spawn } = require('node:child_process');

const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta\.(?:0|[1-9]\d*))?$/;
const launcherDirectory = dirname(__filename);
const dataDirectory = dirname(launcherDirectory);
const pointerPath = join(dataDirectory, 'host-current.json');
const pointerStat = lstatSync(pointerPath);
if (!pointerStat.isFile() || pointerStat.isSymbolicLink()) {
  throw new Error('Panerelay Host pointer must be a regular file');
}

const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
if (!pointer || typeof pointer.version !== 'string' || !RELEASE_PATTERN.test(pointer.version)) {
  throw new Error('Panerelay Host pointer has an invalid release');
}

const hostsDirectory = resolve(dataDirectory, 'hosts');
const hostPath = resolve(hostsDirectory, pointer.version, 'native-host.cjs');
if (!hostPath.startsWith(`${hostsDirectory}${sep}`)) {
  throw new Error('Panerelay Host pointer escapes the managed hosts directory');
}
const hostStat = lstatSync(hostPath);
if (!hostStat.isFile() || hostStat.isSymbolicLink()) {
  throw new Error('Panerelay Host bundle must be a regular file');
}

const child = spawn(process.execPath, [hostPath], {
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
child.once('error', error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
