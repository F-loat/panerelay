import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const extensionDirectory = fileURLToPath(new URL('.', import.meta.url));
const configFile = join(extensionDirectory, 'vite.config.ts');

for (const mode of ['chromium', 'firefox']) {
  await build({
    configFile,
    mode,
    root: extensionDirectory,
  });
}
