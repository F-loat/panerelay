import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

if (
  typeof packageManifest.version !== 'string' ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.test(
    packageManifest.version,
  )
) {
  throw new Error('The Bridge package version must be a supported Panerelay release');
}

await build({
  entryPoints: [join(root, 'src/native-host.ts')],
  outfile: join(root, 'dist/native-host.bundle.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  define: {
    __PANERELAY_BRIDGE_RELEASE_VERSION__: JSON.stringify(packageManifest.version),
  },
});
