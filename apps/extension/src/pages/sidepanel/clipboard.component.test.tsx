import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeClipboardText } from './clipboard.js';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

function setClipboard(value: { writeText(value: string): Promise<void> } | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  });
}

function setExecCommand(value: (command: string) => boolean) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
  if (execCommandDescriptor) Object.defineProperty(document, 'execCommand', execCommandDescriptor);
  else Reflect.deleteProperty(document, 'execCommand');
  document.querySelectorAll('textarea[readonly]').forEach(item => item.remove());
  vi.restoreAllMocks();
});

describe('writeClipboardText', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    setClipboard({ writeText });
    setExecCommand(execCommand);

    await expect(writeClipboardText('diagnostic record')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('diagnostic record');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a temporary textarea after Clipboard API rejection', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    setClipboard({ writeText });
    setExecCommand(execCommand);

    await expect(writeClipboardText('fallback record')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea[readonly]')).toBeNull();
  });

  it('returns false and removes the fallback element when copying fails', async () => {
    setClipboard(undefined);
    setExecCommand(() => {
      throw new Error('copy unavailable');
    });

    await expect(writeClipboardText('uncopied record')).resolves.toBe(false);
    expect(document.querySelector('textarea[readonly]')).toBeNull();
  });
});
