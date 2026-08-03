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
  const i18n = await read('src/i18n.ts');

  for (const requiredText of [
    'Let Agents work with',
    'the browser you already use.',
    'Set up with your Agent',
    'Work with an Agent beside the page.',
    'Connect your automation tools.',
    'npx --yes @panerelay/setup',
    'Let your Agent handle the integration.',
    'Fetch this guide with curl -fsSL',
    'Install the Panerelay integration',
    'Install the local integration',
    'Browser access',
    'This tab',
    'All tabs',
    'EXTERNAL CONTROL',
    'Control released',
    'This tab remains authorized.',
    'Connect agent-browser to your everyday tabs.',
    'Connect browser-use',
    'Work with local Agents',
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
  assert.match(html, /browser-use CLI · Browser Harness/);
  assert.match(html, /browser-use CLI/);
  assert.match(html, /browser-use &lt;&lt;'PY'[\s\S]+print\(list_tabs\(\)\)/);
  assert.doesNotMatch(html, /panerelay-browser-use-cli/);
  assert.doesNotMatch(html, /browser-use tab list/);
  assert.doesNotMatch(html, /await browser\./);
  assert.doesNotMatch(html, /data-copy-command="[^\"]*--(?:agent-browser|browser-use)/);
  assert.doesNotMatch(html, /waiting for your approval|You authorize this tab/);
  assert.equal(
    (i18n.match(/https:\/\/f-loat\.github\.io\/panerelay\/agent-setup\.md/g) ?? []).length,
    8,
  );
  assert.equal((i18n.match(/curl -fsSL/g) ?? []).length, 8);

  const englishCatalog = i18n.slice(
    i18n.indexOf('const english ='),
    i18n.indexOf('const chinese ='),
  );
  const chineseCatalog = i18n.slice(i18n.indexOf('const simplifiedChinese'));
  const referencedKeys = [
    ...html.matchAll(
      /data-(?:i18n(?:-html|-aria-label|-content)?|copy-(?:text|label|success)-key)="([^"]+)"/g,
    ),
  ].map(match => match[1]);
  for (const key of referencedKeys) {
    const escapedKey = key.replaceAll('.', '\\.');
    assert.match(englishCatalog, new RegExp(`['"]${escapedKey}['"]:`));
    assert.match(chineseCatalog, new RegExp(`['"]${escapedKey}['"]:`));
  }
});

test('source preserves semantic and accessible interactions', async () => {
  const html = await read('index.html');
  const i18n = await read('src/i18n.ts');
  const script = await read('src/main.ts');
  const styles = await read('src/styles.css');

  for (const landmark of ['<header', '<nav', '<main', '<section', '<footer']) {
    assert.match(html, new RegExp(landmark));
  }

  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /class="nav-github"[\s\S]+?aria-label="GitHub"/);
  assert.equal((html.match(/data-copy-command=/g) ?? []).length, 1);
  assert.equal((html.match(/data-copy-text-key=/g) ?? []).length, 4);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/data-engine-tab=/g) ?? []).length, 2);
  assert.equal((html.match(/data-engine-panel=/g) ?? []).length, 2);
  assert.equal((html.match(/data-handoff-tab=/g) ?? []).length, 3);
  assert.equal((html.match(/data-handoff-panel=/g) ?? []).length, 3);
  assert.match(html, /class="setup-agent-step"/);
  assert.match(html, /data-handoff-command/);
  assert.match(html, /data-handoff-command-copy/);
  assert.equal((html.match(/data-demo-step=/g) ?? []).length, 6);
  assert.equal((html.match(/data-demo-panel=/g) ?? []).length, 6);
  assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 11);
  assert.match(html, /data-product-demo/);
  assert.match(html, /data-demo-toggle/);
  assert.match(html, /data-demo-replay/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(i18n, /'hero\.agentSetup': '交给 Agent 接入'/);
  assert.match(script, /button\.dataset\.copiedLabel = translation\('command\.copied'\)/);
  assert.doesNotMatch(script, /label\.textContent = translation\('command\.copied'\)/);
  assert.match(
    styles,
    /button\[data-copied='true'\]::after \{[\s\S]+?position: absolute;[\s\S]+?content: attr\(data-copied-label\)/,
  );
  assert.doesNotMatch(styles, /min-inline-size: 18ch/);
  assert.match(script, /event\.key !== 'Escape'/);
  assert.match(script, /getAttribute\('aria-expanded'\) !== 'true'/);
  assert.match(script, /ENGINE_ROTATION_INTERVAL_MS\s*=\s*6_000/);
  assert.match(script, /engineSelectionIsManual/);
  assert.match(script, /engineRotationPaused/);
  assert.match(script, /pointerenter/);
  assert.match(script, /pointerleave/);
  assert.match(script, /focusin/);
  assert.match(script, /focusout/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /gsap\.timeline/);
  assert.match(script, /gsap\.matchMedia/);
  assert.match(script, /addDemoTimelineStage\(timeline, 'install', 2\.2\)/);
  assert.match(script, /addDemoTimelineStage\(timeline, 'local', 2\.6\)/);
  assert.match(script, /addDemoTimelineStage\(timeline, 'tool', 3\)/);
  assert.match(script, /addDemoTimelineStage\(timeline, 'authorize', 2\.5\)/);
  assert.match(script, /addDemoTimelineStage\(timeline, 'work', 3\.3\)/);
  assert.match(script, /addDemoTimelineStage\(timeline, 'release', 1\.8\)/);
  assert.match(script, /productDemoTimeline\?\.pause\(\)\.seek\(stage, true\)/);
  assert.match(script, /demoPausedForHover/);
  assert.match(script, /demoPausedForFocus/);
  assert.doesNotMatch(script, /repeat:\s*-1/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /productDemoTimeline\.restart/);
  assert.match(script, /--demo-step-progress/);
  assert.match(script, /dataset\.demoAutoplay/);
  assert.match(script, /productDemoTimeline\?\.kill/);
  assert.match(script, /demoMedia\.revert/);
  assert.doesNotMatch(script, /ScrollTrigger/);
  assert.match(script, /ArrowLeft[\s\S]+ArrowRight[\s\S]+Home[\s\S]+End/);
  assert.match(script, /'agent-browser': 'npx --yes @panerelay\/setup --agent-browser'/);
  assert.match(script, /'browser-use': 'npx --yes @panerelay\/setup --browser-use'/);
  assert.match(script, /both: 'npx --yes @panerelay\/setup --agent-browser --browser-use'/);
  assert.match(script, /handoffCommandCopy\.dataset\.copyCommand = command/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /\.primary-navigation > \.button-small/);
  assert.match(styles, /\.primary-navigation > \.nav-github/);
  assert.match(styles, /\.language-switcher \+ \.button-small/);
  assert.match(styles, /\.engine-tabs/);
  assert.match(styles, /\.engine-panel/);
  assert.match(
    styles,
    /\.workflow \{[\s\S]+?--workflow-copy-track: 0\.88fr;[\s\S]+?--workflow-demo-track: 1\.12fr;[\s\S]+?grid-template-columns: var\(--workflow-copy-track\) var\(--workflow-demo-track\);/,
  );
  assert.match(
    styles,
    /\.engine-panel \{[\s\S]+?grid-template-columns: var\(--workflow-copy-track\) var\(--workflow-demo-track\);/,
  );
  assert.doesNotMatch(styles, /(?:^|\})\s*\.workflow-panel\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.agent-handoff-picker/);
  assert.match(styles, /\.agent-prompt/);
  assert.match(
    styles,
    /\.agent-prompt \.agent-prompt-copy \{[\s\S]+?position: absolute;[\s\S]+?top: 50%;[\s\S]+?right: 14px;/,
  );
  assert.match(styles, /\.copy-button \{[\s\S]+?min-width: 84px;[\s\S]+?min-height: 40px;/);
  assert.doesNotMatch(
    styles,
    /\.agent-prompt \.agent-prompt-copy \{[^}]*\b(?:width|min-width|min-height|padding):/,
  );
  assert.doesNotMatch(
    styles,
    /\.agent-prompt \.agent-prompt-copy \[?[^\{]*copy-label[^\{]*\{\s*display: none;/,
  );
  assert.match(styles, /\.setup-steps > \.setup-agent-step/);
  assert.match(styles, /\.setup-agent-step \.bridge-visual/);
  assert.match(styles, /\.bridge-visual \{[\s\S]+?justify-content: center;/);
  assert.match(styles, /\.setup-section \{[\s\S]+?padding-bottom: 0;/);
  assert.match(styles, /\.trust-section \{[\s\S]+?border-top: 0;/);
  assert.match(styles, /\.product-demo-frame/);
  assert.match(styles, /min-height: calc\(100svh - 75px\)/);
  assert.match(styles, /@media \(min-width: 901px\) and \(max-height: 820px\)/);
  assert.match(styles, /@media \(min-width: 901px\) and \(max-width: 1100px\)/);
  assert.match(styles, /\.demo-progress/);
  assert.match(styles, /right: 0;\s+left: 0;/);
  assert.match(styles, /scaleX\(var\(--demo-step-progress, 1\)\)/);
  assert.match(
    styles,
    /\.agent-avatar \{[\s\S]+?width: 34px;[\s\S]+?height: 34px;[\s\S]+?flex: 0 0 34px;/,
  );
  assert.match(styles, /\.journey-panel\[hidden\]/);
  assert.match(styles, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.engine-tabs \{[\s\S]+?width: max-content/);
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
  assert.match(i18n, /让 Agent 在<span>你的日常浏览器里工作。<\/span>/);
  assert.match(i18n, /复用 Chrome \/ Edge 的现有登录态/);
  assert.match(i18n, /只在明确授权的标签页后台工作，不抢占焦点/);
  assert.match(i18n, /后台工作，不抢焦点/);
  assert.match(i18n, /已找出 2 个影响发布的问题/);
  assert.match(i18n, /请用 curl -fsSL 读取此指南/);
  assert.match(i18n, /执行 agent-browser 场景/);
  assert.match(i18n, /执行 browser-use 场景/);
  assert.match(i18n, /执行 agent-browser 与 browser-use 组合场景/);
  assert.match(i18n, /Browser Harness 驱动的 CLI/);
  assert.match(i18n, /控制权始终看得见/);
  assert.match(i18n, /当前标签页仍保持授权；再次点击已选范围，才会取消授权/);
  assert.match(i18n, /获得访问，<br>不等于获得控制。<br><em>控制权始终可见。<\/em>/);
  assert.match(i18n, /把 agent-browser<br>接入日常标签页。/);
  assert.match(i18n, /把 browser-use<br>接入已登录的 Chrome。/);
  assert.match(i18n, /AGENT 侧边栏 · 自动化工具接入/);
  assert.match(i18n, /在页面旁使用 Agent，<br><em>也能接入现有自动化工具。<\/em>/);
  assert.match(i18n, /browser-use 0\.13\.7 \+ Browser Harness 0\.1\.8/);
  assert.match(i18n, /在页面旁<br>和本地 Agent 协作。/);
  assert.match(styles, /html\[lang='zh-CN'\] \.workflow-copy h3/);
  assert.match(styles, /html\[lang='zh-CN'\] \.step-content h3/);
  assert.match(styles, /html\[lang='zh-CN'\] \.trust-copy h2/);
  assert.match(styles, /html\[lang='zh-CN'\] \.final-content h2/);
  assert.match(styles, /html\[lang='zh-CN'\] \.hero h1 span \{[\s\S]+?font-size: 0\.6em;/);
  assert.match(styles, /text-wrap: balance/);

  for (const key of new Set([...htmlKeys, ...scriptTranslationKeys])) {
    const keyPattern = new RegExp(`['"]${key.replaceAll('.', '\\.')}['"]\\s*:`);
    assert.match(english, keyPattern, `missing English translation for ${key}`);
    assert.match(simplifiedChinese, keyPattern, `missing Chinese translation for ${key}`);
  }
});

test('published Agent setup guide keeps upstream installation and user authorization explicit', async () => {
  const guide = await read('../../docs/agent-setup.md');
  const publishedGuide = await read('dist/agent-setup.md');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(publishedGuide, guide);
  assert.equal(packageJson.dependencies.gsap.startsWith('^3.'), true);
  assert.match(guide, /does \*\*not\*\* install, update, downgrade/);
  assert.match(guide, /https:\/\/agent-browser\.dev\/installation/);
  assert.match(guide, /https:\/\/docs\.browser-use\.com\/open-source\/browser-use-cli/);
  assert.match(guide, /npx --yes @panerelay\/setup --agent-browser/);
  assert.match(guide, /npx --yes @panerelay\/setup --browser-use/);
  assert.match(guide, /npx --yes @panerelay\/setup --agent-browser --browser-use/);
  assert.match(guide, /doctor --agent-browser --browser-use/);
  assert.match(guide, /agent-browser --provider panerelay tab list/);
  assert.match(
    guide,
    /invoke `BU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use browser-use` directly and run its pre-imported `list_tabs\(\)` helper/,
  );
  assert.match(guide, /BU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use/);
  assert.match(guide, /Browser Harness listed only explicitly authorized tabs/);
  assert.doesNotMatch(guide, /browser-use --version/);
  assert.match(guide, /Stop and ask the user to authorize/);
  assert.match(guide, /Do not claim completion/);
  assert.match(guide, /https:\/\/f-loat\.github\.io\/panerelay\/agent-setup\.md/);
  assert.doesNotMatch(guide, /\]\(\.\.\/packages\//);
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
