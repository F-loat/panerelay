import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const spikeDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(spikeDirectory, 'fixtures', 'native-host-stable-launcher');

function encode(message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

class NativeClient {
  #buffer = Buffer.alloc(0);
  #pending = [];

  constructor(launcherPath, actor) {
    this.child = spawn(process.execPath, [launcherPath], {
      env: { ...process.env, PANERELAY_SPIKE_BROWSER: actor },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.stderr = '';
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', chunk => {
      this.stderr += chunk;
    });
    this.child.stdout.on('data', chunk => this.#push(chunk));
  }

  #push(chunk) {
    this.#buffer = this.#buffer.length === 0 ? chunk : Buffer.concat([this.#buffer, chunk]);
    while (this.#buffer.length >= 4) {
      const length = this.#buffer.readUInt32LE(0);
      if (this.#buffer.length < length + 4) return;
      const payload = JSON.parse(this.#buffer.subarray(4, length + 4).toString('utf8'));
      this.#buffer = this.#buffer.subarray(length + 4);
      this.#pending.shift()?.resolve(payload);
    }
  }

  request(requestId) {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Native Host fixture timed out: ${this.stderr}`));
      }, 5_000);
      this.#pending.push({
        resolve: value => {
          clearTimeout(timer);
          resolvePromise(value);
        },
      });
      this.child.stdin.write(encode({ requestId }));
    });
  }

  async close() {
    this.child.stdin.end();
    await new Promise((resolvePromise, reject) => {
      this.child.once('error', reject);
      this.child.once('exit', () => resolvePromise());
    });
  }
}

async function writePointer(root, version) {
  const path = join(root, 'host-current.json');
  const staged = `${path}.${process.pid}.staged`;
  await writeFile(staged, `${JSON.stringify({ version })}\n`, { mode: 0o600 });
  await rename(staged, path);
}

async function installFixture(root, version) {
  const versionDirectory = join(root, 'hosts', version);
  await mkdir(versionDirectory, { mode: 0o700, recursive: true });
  await copyFile(
    join(fixtureDirectory, 'native-host.cjs'),
    join(versionDirectory, 'native-host.cjs'),
  );
}

const root = await mkdtemp(join(tmpdir(), 'panerelay native host spike '));
try {
  const binDirectory = join(root, 'bin');
  await mkdir(binDirectory, { mode: 0o700, recursive: true });
  const launcherPath = join(binDirectory, 'panerelay native host launcher.cjs');
  await copyFile(join(fixtureDirectory, 'launcher.cjs'), launcherPath);
  await installFixture(root, '0.7.0');
  await installFixture(root, '0.8.0-beta.42');
  await writePointer(root, '0.7.0');

  const chromeOld = new NativeClient(launcherPath, 'chrome');
  const edgeOld = new NativeClient(launcherPath, 'edge');
  assert.deepEqual(await chromeOld.request('chrome-before'), {
    actor: 'chrome',
    requestId: 'chrome-before',
    version: '0.7.0',
  });
  assert.deepEqual(await edgeOld.request('edge-before'), {
    actor: 'edge',
    requestId: 'edge-before',
    version: '0.7.0',
  });

  await writePointer(root, '0.8.0-beta.42');
  assert.equal((await chromeOld.request('chrome-after-pointer')).version, '0.7.0');
  assert.equal((await edgeOld.request('edge-after-pointer')).version, '0.7.0');
  await Promise.all([chromeOld.close(), edgeOld.close()]);

  const chromeNew = new NativeClient(launcherPath, 'chrome');
  const edgeNew = new NativeClient(launcherPath, 'edge');
  assert.equal((await chromeNew.request('chrome-reconnect')).version, '0.8.0-beta.42');
  assert.equal((await edgeNew.request('edge-reconnect')).version, '0.8.0-beta.42');
  await Promise.all([chromeNew.close(), edgeNew.close()]);

  process.stdout.write(
    `${JSON.stringify({
      actors: ['chrome', 'edge'],
      initialVersion: '0.7.0',
      pathContainsSpaces: true,
      reconnectedVersion: '0.8.0-beta.42',
      runningProcessesPreserved: true,
      stdioFraming: 'pass',
    })}\n`,
  );
} finally {
  await rm(root, { force: true, recursive: true });
}
