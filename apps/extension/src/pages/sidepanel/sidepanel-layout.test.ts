import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('keeps recent conversations inside their own scroll container', async () => {
  const styles = await readFile(join(process.cwd(), 'src/pages/sidepanel/styles.css'), 'utf8');
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
  const styles = await readFile(join(process.cwd(), 'src/pages/sidepanel/styles.css'), 'utf8');
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
