import assert from 'node:assert/strict';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createConversationContextInstructions,
  resolveConversationStartOptions,
  sanitizeConversationPageUrl,
} from './agent-context.js';

const target = {
  browserId: '11111111-1111-4111-8111-111111111111',
  targetId: '22222222-2222-4222-8222-222222222222',
};

test('redacts sensitive URL metadata and bounds the page title', () => {
  const url = sanitizeConversationPageUrl(
    'https://user:pass@example.com/page?token=abc&view=full#session=secret',
  );
  assert.doesNotMatch(url, /user|pass|abc|secret/);
  assert.match(url, /%5BREDACTED%5D/);

  const resolved = resolveConversationStartOptions({
    initialPage: { url, title: 'x'.repeat(500) },
  });
  assert.equal(resolved.initialPage?.title?.length, 300);
});

test('validates the workspace and creates only untrusted tab context', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-context-'));
  const resolved = resolveConversationStartOptions({
    cwd: directory,
    initialPage: { url: 'https://example.com/app', title: 'Example app' },
  });
  const instructions = createConversationContextInstructions(resolved);

  assert.equal(resolved.cwd, await realpath(directory));
  assert.doesNotMatch(instructions, /projectDirectory|panerelay_browser|browser tool/i);
  assert.match(instructions, /\$panerelay-browser/);
  assert.match(instructions, /Do not switch to another browser automation Skill or tool/);
  assert.match(instructions, /Select exactly one automation engine/);
  assert.match(instructions, /otherwise use agent-browser/);
  assert.match(instructions, /Do not probe every supported executable/);
  assert.match(instructions, /ask the user to choose an engine merely because none was named/);
  assert.match(instructions, /browser-work request as authorization/);
  assert.match(instructions, /normal command-approval flow/);
  assert.match(instructions, /npx skills add F-loat\/panerelay --skill panerelay-browser/);
  assert.match(instructions, /Only if installation cannot complete/);
  assert.match(instructions, /fall back to another available browser automation tool/);
  assert.match(instructions, /untrusted metadata/);
  assert.match(instructions, /https:\/\/example\.com\/app/);
  assert.match(instructions, /No raw browser tab ID/);
  assert.doesNotMatch(instructions, /"tabId"|"authorization"|"control"/);
});

test('renders exact non-authorizing engine target guidance and rejects malformed hints', () => {
  const resolved = resolveConversationStartOptions({ initialPage: { target } });
  const instructions = createConversationContextInstructions(resolved);

  assert.deepEqual(resolved.initialPage, { target });
  assert.match(
    instructions,
    /--session panerelay-v2-ERERERERQRGBERERERERESIiIiIiIkIigiIiIiIiIiI --provider panerelay/,
  );
  assert.match(instructions, /BU_NAME=panerelay/);
  assert.match(instructions, /switch_tab\("22222222-2222-4222-8222-222222222222"\)/);
  assert.match(instructions, /\/cdp\/playwright\/target\/[A-Za-z0-9_-]+/);
  assert.match(instructions, /tab-select 0/);
  assert.match(instructions, /not authorization or control/);
  assert.match(instructions, /Do not match URL\/title/);
  assert.match(instructions, /start another Browser Use daemon/);
  assert.doesNotMatch(instructions, /browser tab context/);

  assert.throws(
    () =>
      resolveConversationStartOptions({
        initialPage: {
          target: { browserId: target.browserId, targetId: 'not-a-uuid' },
        },
      }),
    /Invalid Panerelay conversation target hint/,
  );
});

test('keeps project selection as cwd while retaining provider-neutral Skill guidance', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-project-'));
  const resolved = resolveConversationStartOptions({ cwd: directory });

  assert.equal(resolved.cwd, await realpath(directory));
  const instructions = createConversationContextInstructions(resolved);
  assert.match(instructions, /\$panerelay-browser/);
  assert.match(instructions, /browser-work request as authorization/);
  assert.match(instructions, /normal command-approval flow/);
  assert.match(instructions, /npx skills add F-loat\/panerelay --skill panerelay-browser/);
  assert.match(instructions, /Only if installation cannot complete/);
  assert.doesNotMatch(instructions, /browser tab context|projectDirectory/);
});

test('adds registered integrations as a staleable fast-path hint', () => {
  const instructions = createConversationContextInstructions(resolveConversationStartOptions({}), {
    agentBrowser: { registered: true, isDefault: true },
    browserUse: { registered: true, mode: 'extension' },
    playwright: { registered: true },
  });

  assert.match(instructions, /cached hint; may be stale/);
  assert.match(instructions, /agent-browser: Panerelay Provider registered and selected/);
  assert.match(instructions, /Browser Use: Panerelay adapter registered with extension mode/);
  assert.match(instructions, /Playwright CLI: Panerelay adapter registered/);
  assert.match(instructions, /select exactly one registration as the fast path/);
  assert.match(
    instructions,
    /registered default and then agent-browser, Browser Use, or Playwright CLI/,
  );
  assert.match(instructions, /Do not inspect the other registered engines/);
  assert.match(instructions, /do not repeat generic operating-system/);
  assert.match(instructions, /takes precedence over the Skill’s generic readiness workflow/);
  assert.match(instructions, /does not prove.*Extension is connected/);
  assert.match(instructions, /first direct invocation or attach fails/);
  assert.doesNotMatch(instructions, /\.panerelay|executablePath|cli-adapters\.json/);
});
