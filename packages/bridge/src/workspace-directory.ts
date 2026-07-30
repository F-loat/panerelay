import { execFile } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export type DirectoryPickerRunner = (command: string, args: string[]) => Promise<string | null>;

interface CommandError extends Error {
  code?: string | number;
}

function selectedPath(stdout: string): string | null {
  const value = stdout.replace(/[\r\n]+$/, '');
  return value || null;
}

export const runDirectoryPickerCommand: DirectoryPickerRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', windowsHide: true }, (error, stdout) => {
      if (!error) {
        resolve(selectedPath(stdout));
        return;
      }
      if ((error as CommandError).code === 1) {
        resolve(null);
        return;
      }
      reject(error);
    });
  });

function isMissingCommand(error: unknown): boolean {
  return error instanceof Error && (error as CommandError).code === 'ENOENT';
}

export async function pickWorkspaceDirectory(
  platform: NodeJS.Platform = process.platform,
  run: DirectoryPickerRunner = runDirectoryPickerCommand,
): Promise<string | null> {
  let directory: string | null;
  if (platform === 'darwin') {
    directory = await run('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Select a project for Panerelay")',
    ]);
  } else if (platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
      "$dialog.Description = 'Select a project for Panerelay';",
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;',
      'Write-Output $dialog.SelectedPath;',
      '}',
    ].join(' ');
    directory = await run('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
  } else if (platform === 'linux') {
    try {
      directory = await run('zenity', [
        '--file-selection',
        '--directory',
        '--title=Select a project for Panerelay',
      ]);
    } catch (error) {
      if (!isMissingCommand(error)) throw error;
      try {
        directory = await run('kdialog', [
          '--getexistingdirectory',
          '.',
          '--title',
          'Select a project for Panerelay',
        ]);
      } catch (fallbackError) {
        if (!isMissingCommand(fallbackError)) throw fallbackError;
        throw new Error('Install zenity or kdialog to select a Panerelay project directory', {
          cause: fallbackError,
        });
      }
    }
  } else {
    throw new Error(`Directory selection is not supported on ${platform}`);
  }

  return directory ? resolveWorkspaceDirectory(directory) : null;
}

export function resolveWorkspaceDirectory(directory: unknown): string {
  if (typeof directory !== 'string' || !directory) {
    throw new Error('Workspace directory is required');
  }
  if (!path.isAbsolute(directory)) {
    throw new Error('Workspace directory must be an absolute path');
  }

  let resolved: string;
  try {
    resolved = realpathSync.native(directory);
  } catch (error) {
    throw new Error(`Workspace directory does not exist: ${directory}`, { cause: error });
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${directory}`);
  }
  return resolved;
}
