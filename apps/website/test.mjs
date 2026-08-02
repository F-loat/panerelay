import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const websiteRoot = dirname(fileURLToPath(import.meta.url));

async function read(relativePath) {
  return readFile(join(websiteRoot, relativePath), 'utf8');
}

test('source contains the complete product and installation journey', async () => {
  const html = await read('index.html');

  for (const requiredText of [
    'Your browser.',
    'Agent-ready.',
    'Agent in Browser.',
    'Agent Use Browser.',
    'npx --yes @panerelay/setup',
    'Ask your Agent to connect the workflow.',
    'Set up Panerelay so my Agent can use agent-browser',
    'Set up Panerelay so my Agent can use browser-use',
    'Set up Panerelay for both agent-browser and browser-use',
    'Bring agent-browser into your daily tabs.',
    'Keep browser-use.',
    'Bring local Agents into the side panel.',
    'Chrome Web Store',
    'agent-browser 0.33.0',
    'browser-use 0.13.7',
    'Edge remains <code>Forwarded</code>',
    'Credentials stay in the browser.',
    'No browser-process ownership.',
    'MIT License',
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(html, /chromewebstore\.google\.com\/detail\/panerelay\//);
  assert.match(html, /https:\/\/agent-browser\.dev\//);
  assert.match(html, /Browser\s+Harness 0\.1\.8/);
  assert.match(html, /https:\/\/docs\.browser-use\.com\/open-source\/browser-use-cli/);
  assert.match(html, /https:\/\/github\.com\/F-loat\/panerelay/);
  assert.match(html, /docs\/compatibility\/browser-platforms\.md/);
  assert.match(html, /docs\/compatibility\/browser-use-0\.13\.7\.md/);
  assert.doesNotMatch(html, /@panerelay\/setup --(?:agent-browser|browser-use)/);
});

test('source preserves semantic and accessible interactions', async () => {
  const html = await read('index.html');
  const script = await read('src/main.ts');
  const styles = await read('src/styles.css');

  for (const landmark of ['<header', '<nav', '<main', '<section', '<footer']) {
    assert.match(html, new RegExp(landmark));
  }

  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /class="nav-github"[\s\S]+?aria-label="GitHub"/);
  assert.equal((html.match(/data-copy-command=/g) ?? []).length, 2);
  assert.equal((html.match(/data-copy-text-key=/g) ?? []).length, 3);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/data-engine-tab=/g) ?? []).length, 2);
  assert.equal((html.match(/data-engine-panel=/g) ?? []).length, 2);
  assert.equal((html.match(/data-handoff-tab=/g) ?? []).length, 3);
  assert.equal((html.match(/data-handoff-panel=/g) ?? []).length, 3);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(script, /event\.key !== 'Escape'/);
  assert.match(script, /getAttribute\('aria-expanded'\) !== 'true'/);
  assert.match(script, /ENGINE_ROTATION_INTERVAL_MS = 6_000/);
  assert.match(script, /engineSelectionIsManual/);
  assert.match(script, /pointerenter/);
  assert.match(script, /pointerleave/);
  assert.match(script, /focusin/);
  assert.match(script, /focusout/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /'ArrowLeft', 'ArrowRight', 'Home', 'End'/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /\.primary-navigation > \.button-small/);
  assert.match(styles, /\.primary-navigation > \.nav-github/);
  assert.match(styles, /\.language-switcher \+ \.button-small/);
  assert.match(styles, /\.engine-tabs/);
  assert.match(styles, /\.engine-panel/);
  assert.match(styles, /\.agent-handoff-picker/);
  assert.match(styles, /\.agent-prompt/);
});

test('source provides complete English and Simplified Chinese language contracts', async () => {
  const html = await read('index.html');
  const script = await read('src/main.ts');
  const i18n = await read('src/i18n.ts');
  const styles = await read('src/styles.css');
  const english = i18n.match(/const english = \{([\s\S]+?)\} as const;/)?.[1] ?? '';
  const simplifiedChinese =
    i18n.match(/const simplifiedChinese:[^=]+ = \{([\s\S]+?)\n\};/)?.[1] ?? '';
  const htmlKeys = [...html.matchAll(/data-i18n(?:-html|-aria-label|-content)?="([^"]+)"/g)].map(
    match => match[1],
  );
  const scriptTranslationKeys = [...script.matchAll(/translation\(([^)]*)\)/g)].flatMap(match =>
    [...match[1].matchAll(/'([\w.]+)'/g)].map(keyMatch => keyMatch[1]),
  );

  assert.equal((html.match(/data-language-option=/g) ?? []).length, 2);
  assert.match(html, /data-language-option="zh-CN"/);
  assert.match(html, /data-language-option="en"/);
  assert.match(script, /navigator\.languages\[0\]/);
  assert.match(script, /window\.localStorage\.getItem\(localeStorageKey\)/);
  assert.match(script, /document\.documentElement\.lang = locale/);
  assert.match(script, /const localeStorageKey = 'panerelay\.locale'/);
  assert.match(i18n, /浏览器不用换。<span>Agent 直接上手。<\/span>/);
  assert.match(i18n, /Agent 在浏览器里，<br><em>也能直接使用浏览器。<\/em>/);
  assert.match(i18n, /不用另开配置文件，不用反复登录，也不用导出 Cookie/);
  assert.match(i18n, /请帮我把 Panerelay 接入 agent-browser/);
  assert.match(i18n, /请帮我把 Panerelay 接入 browser-use/);
  assert.match(i18n, /请帮我同时完成 Panerelay 的 agent-browser 和 browser-use 接入/);
  assert.match(i18n, /控制权始终看得见/);
  assert.match(i18n, /获得访问，<br>不等于获得控制。<br><em>控制权始终可见。<\/em>/);
  assert.match(i18n, /让 agent-browser<br>直接操作日常标签页。/);
  assert.match(i18n, /继续用 browser-use，<br>复用已登录的 Chrome。/);
  assert.match(i18n, /browser-use 0\.13\.7 \+ Browser Harness 0\.1\.8/);
  assert.match(i18n, /把本地 Agent<br>放到页面旁边。/);
  assert.match(styles, /html\[lang='zh-CN'\] \.workflow-copy h3/);
  assert.match(styles, /html\[lang='zh-CN'\] \.step-content h3/);
  assert.match(styles, /html\[lang='zh-CN'\] \.trust-copy h2/);
  assert.match(styles, /html\[lang='zh-CN'\] \.final-content h2/);
  assert.match(styles, /text-wrap: balance/);

  for (const key of new Set([...htmlKeys, ...scriptTranslationKeys])) {
    const keyPattern = new RegExp(`['"]${key.replaceAll('.', '\\.')}['"]\\s*:`);
    assert.match(english, keyPattern, `missing English translation for ${key}`);
    assert.match(simplifiedChinese, keyPattern, `missing Chinese translation for ${key}`);
  }
});

test('source has no analytics, advertising, external scripts, or unapproved fonts', async () => {
  const html = await read('index.html');
  const script = await read('src/main.ts');
  const styles = await read('src/styles.css');
  const externalStylesheets = [
    ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(https?:\/\/[^"]+)"/g),
  ].map(match => match[1]);

  assert.doesNotMatch(html, /google-analytics|googletagmanager|segment\.com|plausible\.io/i);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+(?:fonts\.googleapis|use\.typekit)/i);
  assert.deepEqual(externalStylesheets, ['https://fontsapi.zeoseven.com/292/main/result.css']);
  assert.match(styles, /html\[lang='zh-CN'\]/);
  assert.match(styles, /'PingFang SC'/);
  assert.match(styles, /'LXGW WenKai'/);
  assert.match(styles, /word-break: keep-all/);
  assert.doesNotMatch(styles, /@font-face|TsangerJinKai02/);
  assert.doesNotMatch(html, /document\.cookie|localStorage|sessionStorage/);
  assert.doesNotMatch(script, /document\.cookie|sessionStorage/);
  assert.equal((script.match(/panerelay\.locale/g) ?? []).length, 1);
});

test('illustration labels keep content separate from decorative affordances', async () => {
  const styles = await read('src/styles.css');

  assert.match(styles, /\.authorization-pill > span:first-child/);
  assert.match(styles, /\.authorization-pill > span:last-child/);
  assert.doesNotMatch(styles, /\.authorization-pill span\s*\{/);
  assert.match(styles, /\.code-title > span:first-child/);
  assert.match(styles, /\.code-title > span:last-child/);
  assert.doesNotMatch(styles, /\.code-title span\s*\{/);
  assert.match(styles, /\.demo-composer > span:first-child/);
  assert.match(styles, /\.demo-composer > span:last-child/);
  assert.doesNotMatch(styles, /\.demo-composer span\s*\{/);
});

test('production output uses relative project-path assets', async () => {
  const html = await read('dist/index.html');
  const manifest = await read('dist/site.webmanifest');
  const robots = await read('dist/robots.txt');
  const workflow = await read('../../.github/workflows/pages.yml');
  const socialCard = await readFile(join(websiteRoot, 'dist/social-card.png'));

  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="\/assets\//);
  assert.match(html, /href="\.\/panerelay-icon\.svg"/);
  assert.match(html, /https:\/\/f-loat\.github\.io\/panerelay\/social-card\.png/);
  assert.match(manifest, /"\.\/panerelay-icon\.svg"/);
  assert.match(manifest, /"start_url":\s*"\.\/"/);
  assert.match(manifest, /"scope":\s*"\.\/"/);
  assert.deepEqual([...socialCard.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(robots, /https:\/\/f-loat\.github\.io\/panerelay\/sitemap\.xml/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
});
