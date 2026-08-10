import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PANERELAY_FETCH_ADAPTER_MAX_FILE_BYTES,
  type FetchAdapterCommand,
} from '@panerelay/protocol';
import { prepareFetchAdapterArtifacts } from './fetch-adapter-artifact.js';

const command: FetchAdapterCommand = {
  name: 'upload',
  description: 'Upload a document.',
  access: 'write',
  args: [
    {
      name: 'document',
      description: 'Document to upload.',
      type: 'file',
      required: true,
      positional: true,
    },
  ],
  output: ['ok'],
  examples: ['panerelay example upload document.pdf'],
};

test('prepares one bounded file artifact without retaining its local path', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-artifact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'document.pdf');
  await writeFile(path, '%PDF fixture');
  const prepared = await prepareFetchAdapterArtifacts(command, { document: path });
  const artifact = prepared.artifacts?.[0];
  assert.equal(artifact?.basename, 'document.pdf');
  assert.equal(artifact?.mediaType, 'application/pdf');
  assert.equal(Buffer.from(artifact?.data ?? '', 'base64').toString('utf8'), '%PDF fixture');
  assert.equal(prepared.args.document, artifact?.id);
  assert.equal(JSON.stringify(prepared).includes(root), false);
});

test('rejects symlinks, directories, and files above 12 MiB', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-artifact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'target.txt');
  const linked = join(root, 'linked.txt');
  await writeFile(target, 'secret');
  await symlink(target, linked);
  await assert.rejects(
    prepareFetchAdapterArtifacts(command, { document: linked }),
    /non-symlink regular file/,
  );

  const directory = join(root, 'directory');
  await mkdir(directory);
  await assert.rejects(
    prepareFetchAdapterArtifacts(command, { document: directory }),
    /regular file/,
  );

  const oversized = join(root, 'large.bin');
  await writeFile(oversized, Buffer.alloc(PANERELAY_FETCH_ADAPTER_MAX_FILE_BYTES + 1));
  await assert.rejects(prepareFetchAdapterArtifacts(command, { document: oversized }), /12 MiB/);
});
