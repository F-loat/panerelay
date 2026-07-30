import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  pickWorkspaceDirectory,
  resolveWorkspaceDirectory,
  type DirectoryPickerRunner,
} from './workspace-directory.js';

test('uses the platform directory picker and resolves the selected directory', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-project-'));
  const calls: Array<{ command: string; args: string[] }> = [];
  const run: DirectoryPickerRunner = async (command, args) => {
    calls.push({ command, args });
    return directory;
  };

  assert.equal(await pickWorkspaceDirectory('darwin', run), await realpath(directory));
  assert.equal(calls[0]?.command, 'osascript');
  assert.match(calls[0]?.args.join(' ') || '', /Select a project for Panerelay/);
});

test('preserves cancellation without inventing a directory', async () => {
  assert.equal(await pickWorkspaceDirectory('win32', async () => null), null);
});

test('falls back from zenity to kdialog on Linux', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-project-'));
  const calls: string[] = [];
  const result = await pickWorkspaceDirectory('linux', async command => {
    calls.push(command);
    if (command === 'zenity') {
      const error = new Error('missing') as Error & { code: string };
      error.code = 'ENOENT';
      throw error;
    }
    return directory;
  });

  assert.equal(result, await realpath(directory));
  assert.deepEqual(calls, ['zenity', 'kdialog']);
});

test('rejects relative, missing, and file paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-project-'));
  const file = path.join(directory, 'file.txt');
  await writeFile(file, 'not a directory');

  assert.throws(() => resolveWorkspaceDirectory('relative/project'), /must be an absolute path/);
  assert.throws(() => resolveWorkspaceDirectory(path.join(directory, 'missing')), /does not exist/);
  assert.throws(() => resolveWorkspaceDirectory(file), /not a directory/);
});
