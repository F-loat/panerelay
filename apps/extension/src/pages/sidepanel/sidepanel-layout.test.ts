import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const sidepanelStyleFiles = [
  'styles.css',
  'styles/foundation.css',
  'styles/header.css',
  'styles/settings.css',
  'styles/setup.css',
  'styles/welcome.css',
  'styles/messages.css',
  'styles/activity.css',
  'styles/composer.css',
  'styles/responsive.css',
];

async function readSidepanelStyles(): Promise<string> {
  return (
    await Promise.all(
      sidepanelStyleFiles.map(file =>
        readFile(join(process.cwd(), 'src/pages/sidepanel', file), 'utf8'),
      ),
    )
  ).join('\n');
}

test('keeps recent conversations inside their own scroll container', async () => {
  const styles = await readSidepanelStyles();
  const popover = styles.match(/\.history-popover\s*\{[^}]*\}/)?.[0] ?? '';
  const list = styles.match(/\.history-list\s*\{[^}]*\}/)?.[0] ?? '';

  assert.match(popover, /display: flex/);
  assert.match(popover, /flex-direction: column/);
  assert.match(popover, /max-height:/);
  assert.match(popover, /overflow: hidden/);
  assert.match(list, /min-height: 0/);
  assert.match(list, /overflow-y: auto/);
});

test('aligns the missing-Host card stack with the connected welcome layout', async () => {
  const styles = await readSidepanelStyles();
  const missingHost =
    styles.match(/\.setup-guidance\[data-native-host='true'\]\s*\{[^}]*\}/)?.[0] ?? '';
  const card = styles.match(/\.setup-guide-card\s*\{[^}]*\}/)?.[0] ?? '';
  const suggestions = styles.match(/\.suggestions\s*\{[^}]*\}/)?.[0] ?? '';
  const integrationToggle = styles.match(/\.setup-integration-toggle\s*\{[^}]*\}/)?.[0] ?? '';
  const copyButton = styles.match(/\.setup-command-copy\s*\{[^}]*\}/)?.[0] ?? '';
  const command = styles.match(/\.setup-command-row code\s*\{[^}]*\}/)?.[0] ?? '';
  const sharedSectionTitle =
    styles.match(
      /\.setup-integration-picker > div:first-child strong,\s*\.setup-guidance-status\s*\{[^}]*\}/,
    )?.[0] ?? '';

  assert.match(missingHost, /width: min\(330px, 100%\)/);
  assert.match(suggestions, /width: min\(330px, 100%\)/);
  assert.match(missingHost, /grid-template-columns: 1fr/);
  assert.match(missingHost, /border: 0/);
  assert.match(missingHost, /background: transparent/);
  assert.match(missingHost, /padding: 0/);
  assert.match(card, /border: 1px solid var\(--border\)/);
  assert.match(card, /border-radius: 9px/);
  assert.match(card, /background: color-mix\(in srgb, var\(--surface\) 86%, transparent\)/);
  assert.match(integrationToggle, /min-height: 28px/);
  assert.match(integrationToggle, /font-size: 10px/);
  assert.match(copyButton, /width: 24px/);
  assert.match(copyButton, /height: 24px/);
  assert.match(command, /background: var\(--surface-raised\)/);
  assert.match(sharedSectionTitle, /color: var\(--text\)/);
  assert.match(sharedSectionTitle, /font-size: 11px/);
  assert.doesNotMatch(styles, /setup-integration-check/);
});

test('keeps the accent picker and theme selector together at narrow widths', async () => {
  const styles = await readSidepanelStyles();
  const field = styles.match(/\.settings-theme-field\s*\{[^}]*\}/)?.[0] ?? '';
  const controls = styles.match(/\.settings-theme-controls\s*\{[^}]*\}/)?.[0] ?? '';
  const picker = styles.match(/\.settings-color-picker\s*\{[^}]*\}/)?.[0] ?? '';

  assert.match(field, /grid-template-columns: minmax\(0, 1fr\) 136px/);
  assert.match(controls, /grid-template-columns: 22px minmax\(0, 1fr\)/);
  assert.match(controls, /gap: 6px/);
  assert.match(picker, /width: 22px/);
  assert.match(picker, /height: 22px/);
  assert.match(picker, /border-radius: 50%/);
});

test('overlays message Markdown copy for card hover, keyboard focus, and non-hover input', async () => {
  const styles = await readSidepanelStyles();
  const copyButton = styles.match(/\.message-copy-button\s*\{[^}]*\}/)?.[0] ?? '';
  const richTextSpacing = styles.match(/\.message-bubble > \.rich-text\s*\{[^}]*\}/)?.[0] ?? '';

  assert.match(copyButton, /position: absolute/);
  assert.match(copyButton, /opacity: 0/);
  assert.match(copyButton, /background: var\(--surface-raised\)/);
  assert.match(styles, /\.message-bubble:hover \.message-copy-button/);
  assert.match(styles, /\.message-copy-button:focus-visible/);
  assert.doesNotMatch(styles, /\.message-bubble:focus-within \.message-copy-button/);
  assert.match(styles, /\.message-copy-button svg\s*\{[^}]*width: 13px/);
  assert.equal(richTextSpacing, '');
  assert.match(
    styles,
    /@media \(hover: none\)[\s\S]*\.message-copy-button\s*\{[^}]*opacity: 0\.72/,
  );
});
