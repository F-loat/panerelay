import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));

await build({
  entryPoints: [join(root, 'src/native-host.ts')],
  outfile: join(root, 'dist/native-host.bundle.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
});
