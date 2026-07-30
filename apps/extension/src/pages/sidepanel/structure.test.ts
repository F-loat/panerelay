import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('keeps external control status, activity, gap, and release in one compact section', async () => {
  const directory = join(process.cwd(), 'src/pages/sidepanel');
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const css = await readFile(join(directory, 'styles.css'), 'utf8');
  const source = await readFile(join(directory, 'index.ts'), 'utf8');

  assert.match(html, /data-external-control/);
  assert.match(html, /data-control-actor/);
  assert.match(html, /data-control-gap/);
  assert.match(html, /data-external-activities/);
  assert.match(html, /data-control-release/);
  assert.ok(
    html.indexOf('data-external-control') > html.indexOf('data-browser-scope') &&
      html.indexOf('data-external-control') < html.indexOf('</aside>'),
  );
  assert.ok(html.indexOf('data-external-control') < html.indexOf('data-chat-scroll'));
  assert.match(css, /\.external-control/);
  assert.match(css, /var\(--surface\)/);
  assert.equal(source.match(/externalControl: /g)?.length, 2);
  assert.equal(source.match(/activityHistoryGap: /g)?.length, 2);
});

test('keeps dynamic Agent selection isolated from browser authorization', async () => {
  const directory = join(process.cwd(), 'src/pages/sidepanel');
  const source = await readFile(join(directory, 'index.ts'), 'utf8');
  const selection = await readFile(join(directory, 'provider-selection.ts'), 'utf8');

  assert.match(source, /selectProviderId\(/);
  assert.match(source, /supportedProviders\(/);
  assert.match(source, /PROVIDER_KEY/);
  assert.match(source, /providerNotInstalled/);
  assert.match(source, /option\.label = item\.name/);
  assert.doesNotMatch(source, /No agent provider is available/);
  assert.doesNotMatch(source, /没有可用的 Agent provider/);
  assert.doesNotMatch(source, /option\.disabled = item\.status !== 'ready'/);
  assert.match(source, /conversationProviderId\(conversation, currentProviderId\)/);
  assert.match(source, /conversationProviderId\(currentConversation, currentProviderId\)/);
  assert.match(source, /declineForSession/);
  assert.match(source, /qoderSetupBody/);
  assert.equal(source.match(/qoderSetupBody:/g)?.length, 2);
  assert.match(source, /providerInstall\.textContent = setup\?\.installCommand/);
  assert.match(source, /providerLogin\.textContent = setup\?\.loginCommand/);
  assert.match(source, /providerDocs\.href = docsUrl/);
  assert.match(selection, /SUPPORTED_PROVIDERS/);
  assert.match(selection, /provider\.status === 'ready'/);

  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const css = await readFile(join(directory, 'styles.css'), 'utf8');
  assert.match(html, /data-provider-setup/);
  assert.match(html, /data-provider-install/);
  assert.match(html, /data-provider-login/);
  assert.match(html, /data-provider-docs/);

  const providerChangeStart = source.indexOf("providerSelect.addEventListener('change'");
  const providerChange = source.slice(
    providerChangeStart,
    source.indexOf("authorizationSelect.addEventListener('change'", providerChangeStart),
  );
  assert.match(providerChange, /currentConversation = null/);
  assert.doesNotMatch(providerChange, /setAuthorization/);
  assert.doesNotMatch(html, /data-conversation-state/);
  assert.doesNotMatch(css, /\.conversation-state/);
});

test('reuses browser authorization controls in the compact welcome state', async () => {
  const directory = join(process.cwd(), 'src/pages/sidepanel');
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const css = await readFile(join(directory, 'styles.css'), 'utf8');
  const source = await readFile(join(directory, 'index.ts'), 'utf8');
  const selectMenuSource = await readFile(join(directory, 'select-menu.ts'), 'utf8');

  assert.match(html, /data-welcome-authorization/);
  assert.equal(html.match(/data-scope="single-tab"/g)?.length, 1);
  assert.equal(html.match(/data-scope="all-tabs"/g)?.length, 1);
  assert.equal(html.match(/data-scope-target/g)?.length, 2);
  assert.equal(html.match(/data-scope-help/g)?.length, 1);
  assert.equal(html.match(/data-release/g)?.length, 1);
  assert.match(html, /data-authorization-trigger/);
  assert.match(html, /data-authorization-setting/);
  assert.match(html, /value="none"[^>]*data-i18n="chooseScope"[^>]*hidden/);
  assert.ok(html.indexOf('data-welcome-authorization') > html.indexOf('data-suggestion="find"'));
  assert.match(css, /\.welcome-authorization\s*\{[^}]*min-height: 52px/s);
  assert.match(css, /\.authorization-trigger\s*\{[^}]*min-height: 26px/s);
  assert.match(source, /for \(const node of scopeTargets\)/);
  assert.match(source, /for \(const node of scopeHelps\)/);
  assert.match(source, /for \(const button of releaseButtons\)/);
  assert.match(source, /const authorizationSelectMenu = new SelectMenu/);
  assert.match(
    source,
    /noneOption\.textContent = mode === 'none' \? t\('chooseScope'\) : t\('release'\)/,
  );
  assert.match(source, /noneOption\.hidden = mode === 'none'/);
  assert.match(source, /authorizationSelect\.addEventListener\('change'/);
  assert.match(selectMenuSource, /if \(option\.hidden\) continue/);
  assert.match(source, /welcomeAuthorization\.hidden = !bridgeConnected \|\| !providerReady/);
  assert.match(source, /settingsScopeButtons\.find/);
});

test('registers the actual Chrome runtime Extension ID', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  assert.match(source, /extensionId: chrome\.runtime\.id/);
});

test('uses the Mearl corner-radius ratio for the Panerelay icon', async () => {
  const source = await readFile(join(process.cwd(), 'assets/panerelay-icon.svg'), 'utf8');
  assert.match(source, /<rect width="512" height="512" rx="112" fill="#111513" \/>/);
  assert.doesNotMatch(source, /rx="144"/);
});
