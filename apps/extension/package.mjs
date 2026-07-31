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
function zipExtension(browser) {
  const archive = join(
    outputDirectory,
    `panerelay-extension-${browser}-${packageManifest.version}.zip`,
  );
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      'zip',
      ['-q', '-r', archive, '.', '-x', '*.map', '.DS_Store', '*/.DS_Store'],
      {
        cwd: join(extensionDirectory, 'dist', browser),
        stdio: 'inherit',
      },
    );
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolvePromise(archive);
      else reject(new Error(`zip exited with code ${code ?? 'unknown'}`));
    });
  });
}

await mkdir(outputDirectory, { recursive: true });
const archives = [];
for (const browser of ['chromium', 'firefox']) {
  await build({
    configFile: join(extensionDirectory, 'vite.config.ts'),
    mode: browser,
    root: extensionDirectory,
  });
  const archive = join(
    outputDirectory,
    `panerelay-extension-${browser}-${packageManifest.version}.zip`,
  );
  await rm(archive, { force: true });
  archives.push(await zipExtension(browser));
}

for (const archive of archives) console.log(`Panerelay Extension package: ${archive}`);
