import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const extensionDirectory = fileURLToPath(new URL('.', import.meta.url));
const workspaceDirectory = resolve(extensionDirectory, '../..');
const packageManifest = JSON.parse(
  await readFile(join(extensionDirectory, 'package.json'), 'utf8'),
);
const outputDirectory = join(workspaceDirectory, '.artifacts');
const archive = join(outputDirectory, `panerelay-extension-${packageManifest.version}.zip`);

function zipExtension() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('zip', ['-q', '-r', archive, '.', '-x', '*.map'], {
      cwd: join(extensionDirectory, 'dist'),
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(`zip exited with code ${code ?? 'unknown'}`));
    });
  });
}

await build({
  configFile: join(extensionDirectory, 'vite.config.ts'),
  root: extensionDirectory,
});
await mkdir(outputDirectory, { recursive: true });
await rm(archive, { force: true });
await zipExtension();

console.log(`Panerelay Extension package: ${archive}`);
