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
    'One tab or all supported tabs',
    'Flexible tab scope',
    'Install the Agent Skill',
    'Work with an Agent beside the page.',
    'Connect your automation tools.',
    'npx --yes @panerelay/setup',
    'Two installation steps.',
    'Install one Skill for all three engines.',
    'npx skills add F-loat/panerelay --skill panerelay-browser',
    'Browser access',
    'This tab',
    'All tabs',
    'EXTERNAL CONTROL',
    'Control released',
    'This tab remains authorized.',
    'Connect agent-browser to your everyday tabs.',
    'Connect browser-use',
    'Connect Playwright CLI',
    'playwright-cli',
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
  assert.match(html, /data-engine-panel="playwright"/);
  assert.match(html, /playwright-cli attach --cdp[\s\S]+\/cdp\/playwright/);
  assert.match(html, /packages\/playwright\/README\.md/);
  assert.match(html, /docs\/compatibility\/playwright-cli-0\.1\.17\.md/);
  assert.match(
    html,
    /BU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use browser-use &lt;&lt;'PY'[\s\S]+print\(list_tabs\(\)\)/,
  );
  assert.doesNotMatch(html, /panerelay-browser-use-cli/);
  assert.doesNotMatch(html, /browser-use tab list/);
  assert.doesNotMatch(html, /await browser\./);
  assert.match(html, /data-handoff-command-copy/);
  assert.match(html, /data-copy-command="npx --yes @panerelay\/setup --agent-browser"/);
  assert.match(html, /data-handoff-select="playwright"/);
  assert.match(html, /data-handoff-select="all"/);
  assert.doesNotMatch(html, /waiting for your approval|You authorize this tab/);
  assert.doesNotMatch(html, /agent-setup\.md|curl -fsSL/);
  assert.doesNotMatch(i18n, /agent-setup\.md|curl -fsSL/);
  assert.match(
    html,
    /data-i18n="demo\.local\.body">\s*Work with local Agents beside this browser and choose current-tab or\s+all-supported-tabs access\./,
  );
  assert.match(
    html,
    /data-i18n="demo\.tool\.prompt">\s*Use the panerelay-browser Skill\. Set up agent-browser, run doctor, and stop\s+when I need to authorize a tab\./,
  );
  assert.doesNotMatch(html, /retry-action|demo\.local\.retry/);
  assert.match(i18n, /'setup\.authorization\.link': 'Read advanced setup and manual use'/);
  assert.match(i18n, /'setup\.authorization\.link': '查看高级设置与手动使用'/);
  assert.match(html, /F-loat\/panerelay#advanced-setup-and-installation-management/);
  assert.equal(
    (i18n.match(/npx skills add F-loat\/panerelay --skill panerelay-browser/g) ?? []).length,
    2,
  );

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
  assert.equal((html.match(/data-copy-command=/g) ?? []).length, 2);
  assert.equal((html.match(/data-copy-text-key=/g) ?? []).length, 5);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/data-engine-tab=/g) ?? []).length, 3);
  assert.equal((html.match(/data-engine-panel=/g) ?? []).length, 3);
  assert.equal((html.match(/data-engine-(?:tab|panel)="playwright"/g) ?? []).length, 2);
  assert.match(html, /class="setup-agent-step"/);
  assert.equal((html.match(/data-handoff-tab=/g) ?? []).length, 4);
  assert.equal((html.match(/data-handoff-panel=/g) ?? []).length, 4);
  assert.equal((html.match(/data-demo-step=/g) ?? []).length, 6);
  assert.equal((html.match(/data-demo-panel=/g) ?? []).length, 6);
  assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 13);
  assert.match(html, /data-product-demo/);
  assert.match(html, /data-demo-toggle/);
  assert.match(html, /data-demo-replay/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(i18n, /'hero\.agentSetup': '安装 Agent Skill'/);
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
  assert.doesNotMatch(script, /engineRotationPaused|data-engine-rotation-toggle/);
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
  assert.match(script, /panel\.hidden = !selected;/);
  assert.doesNotMatch(script, /DEMO_FADE_(?:IN|OUT)_SECONDS|demoPanelTransition|autoAlpha/);
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
  assert.match(script, /type HandoffChoice = AutomationEngine \| 'all'/);
  assert.match(script, /playwright: 'npx --yes @panerelay\/setup --playwright'/);
  assert.match(
    script,
    /all: 'npx --yes @panerelay\/setup --agent-browser --browser-use --playwright'/,
  );
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /\.primary-navigation > \.button-small/);
  assert.match(styles, /\.primary-navigation > \.nav-github/);
  assert.match(styles, /\.language-switcher \+ \.button-small/);
  assert.match(styles, /\.engine-tabs/);
  assert.match(styles, /\.engine-panel/);
  assert.doesNotMatch(styles, /\.playwright-compat/);
  assert.match(styles, /\.agent-handoff-picker/);
  assert.match(styles, /\.agent-handoff-panel/);
  assert.match(
    styles,
    /\.workflow \{[\s\S]+?--workflow-copy-track: 0\.88fr;[\s\S]+?--workflow-demo-track: 1\.12fr;[\s\S]+?grid-template-columns: var\(--workflow-copy-track\) var\(--workflow-demo-track\);/,
  );
  assert.match(
    styles,
    /\.engine-panel \{[\s\S]+?grid-template-columns: var\(--workflow-copy-track\) var\(--workflow-demo-track\);/,
  );
  assert.doesNotMatch(styles, /(?:^|\})\s*\.workflow-panel\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.copy-button \{[\s\S]+?min-width: 84px;[\s\S]+?min-height: 40px;/);
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

test('hero presents all three peer tools with stable motion fallbacks', async () => {
  const html = await read('index.html');
  const script = await read('src/main.ts');
  const styles = await read('src/styles.css');
  const i18n = await read('src/i18n.ts');

  assert.match(
    html,
    /class="hero-tool-track"[\s\S]+agent-browser[\s\S]+Browser Use[\s\S]+Playwright CLI/,
  );
  assert.match(html, /class="hero-tool-static"[\s\S]*agent-browser · Browser Use · Playwright CLI/);
  assert.match(i18n, /'hero\.lede\.before': 'Connect'/);
  assert.match(i18n, /'hero\.lede\.before': '把'/);
  assert.match(styles, /@keyframes hero-tool-reel/);
  assert.match(styles, /\.js \.hero-tool-reel \{[\s\S]+?width: 17ch;[\s\S]+?height: 1\.76em;/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]+?\.js \.hero-tool-viewport \{[\s\S]+?display: none;[\s\S]+?\.js \.hero-tool-static \{[\s\S]+?display: inline;/,
  );
  assert.match(script, /const automationEngines: AutomationEngine\[\] = \[[\s\S]+?'playwright'/);
  assert.doesNotMatch(html, /playwright-compat/);
  assert.doesNotMatch(styles, /overflow-x: hidden/);
  assert.doesNotMatch(styles, /\.hero-tool-reel::before/);
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
  assert.match(
    html,
    /data-language-option="zh-CN"[\s\S]*?href="\.\/zh-CN\/"|href="\.\/zh-CN\/"[\s\S]{0,200}?data-language-option="zh-CN"/,
  );
  assert.match(script, /function documentLocale\(\): Locale/);
  assert.match(script, /document\.documentElement\.lang = locale/);
  assert.doesNotMatch(script, /navigator\.languages|localStorage/);
  assert.match(i18n, /让 Agent 在<span>你的日常浏览器里工作。<\/span>/);
  assert.match(i18n, /复用 Chrome \/ Edge 的现有登录态/);
  assert.match(i18n, /可授权当前标签页或全部受支持网页/);
  assert.match(i18n, /授权当前页还是全部受支持网页，由你决定/);
  assert.match(i18n, /授权范围由你选择/);
  assert.match(i18n, /释放控制不会暗中改变授权范围/);
  assert.match(i18n, /后台工作，不抢焦点/);
  assert.match(i18n, /已找出 2 个影响发布的问题/);
  assert.match(i18n, /使用 panerelay-browser Skill，完成 agent-browser 接入并运行 doctor/);
  assert.match(i18n, /一个 Skill 覆盖三种集成/);
  assert.match(i18n, /统一 Skill 中的 Browser Harness CLI/);
  assert.match(i18n, /控制权始终看得见/);
  assert.match(i18n, /当前标签页仍保持授权；再次点击已选范围，才会取消授权/);
  assert.match(i18n, /获得访问，<br>不等于获得控制。<br><em>控制权始终可见。<\/em>/);
  assert.match(i18n, /把 agent-browser<br>接入日常标签页。/);
  assert.match(i18n, /把 browser-use<br>接入已登录的 Chrome。/);
  assert.match(i18n, /把 Playwright CLI<br>接入日常标签页。/);
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

test('public copy keeps flexible authorization and active control distinct', async () => {
  const html = await read('index.html');
  const i18n = await read('src/i18n.ts');
  const manifest = await read('public/site.webmanifest');
  const socialCard = await read('public/social-card.svg');
  const rootReadme = await read('../../README.md');
  const chineseReadme = await read('../../README.zh-CN.md');
  const extensionI18n = await read('../extension/src/pages/sidepanel/i18n.ts');
  const extensionEnglish = await read('../extension/public/_locales/en/messages.json');
  const extensionChinese = await read('../extension/public/_locales/zh_CN/messages.json');

  assert.match(html, /authorize one tab or all supported tabs/);
  assert.match(html, /Release ends active control without silently changing that\s+scope/);
  assert.match(i18n, /One current tab or all supported web tabs/);
  assert.match(i18n, /当前标签页或全部受支持网页/);
  assert.match(i18n, /释放控制时保留已选授权范围/);
  assert.match(rootReadme, /one tab or all supported tabs, your choice/);
  assert.match(
    rootReadme,
    /Release ends active control without clearing the selected authorization scope/,
  );
  assert.match(chineseReadme, /授权当前页还是全部受支持网页，由你决定/);
  assert.match(chineseReadme, /释放会结束当前控制，但保留已选授权范围/);
  assert.match(extensionI18n, /Choose the current tab or all supported tabs/);
  assert.match(extensionI18n, /授权当前标签页或全部受支持网页/);
  assert.match(extensionI18n, /persists until you clear it/);
  assert.match(extensionEnglish, /one tab or all supported tabs in your existing browser/);
  assert.match(extensionChinese, /授权当前标签页或全部受支持网页/);
  assert.match(manifest, /one tab or all supported tabs/);
  assert.match(socialCard, /One tab or all supported tabs · visible control · local-first/);
});

test('comparison pages provide bilingual, sourced, and responsive decision support', async () => {
  const english = await read('compare/index.html');
  const chinese = await read('zh-CN/compare/index.html');
  const styles = await read('src/compare.css');
  const script = await read('src/compare.ts');
  const sitemap = await read('public/sitemap.xml');
  const viteConfig = await read('vite.config.ts');

  for (const [html, locale] of [
    [english, 'en'],
    [chinese, 'zh-CN'],
  ]) {
    assert.match(html, new RegExp(`<html lang="${locale}">`));
    assert.match(html, /<link rel="canonical"/);
    assert.match(html, /hreflang="en"/);
    assert.match(html, /hreflang="zh-CN"/);
    assert.match(html, /hreflang="x-default"/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /"@type": "SoftwareApplication"/);
    assert.match(html, /class="comparison-table"/);
    assert.equal((html.match(/data-label=/g) ?? []).length, 24);
    assert.match(html, /developer\.chrome\.com\/blog\/remote-debugging-port/);
    assert.match(html, /packages\/extension\/README\.md/);
    assert.match(html, /docs\.browser-use\.com\/open-source\/browser-use-cli/);
    assert.match(html, /agent-browser\.dev\/configuration/);
    assert.doesNotMatch(html, /google-analytics|googletagmanager|segment\.com|plausible\.io/i);
    assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  }

  assert.match(english, /current tab or all supported tabs/i);
  assert.match(english, /Authorization and active control are separate decisions/);
  assert.match(english, /Choose another approach when browser ownership is the feature/);
  assert.match(chinese, /当前标签页或全部受支持标签页/);
  assert.match(chinese, /获得授权，与获得当前控制权，是两件不同的事/);
  assert.match(chinese, /如果“拥有浏览器进程”本身就是需求/);
  assert.doesNotMatch(english, /CDP always prompts|Playwright can only use one tab|safest/i);
  assert.doesNotMatch(chinese, /CDP 每次都|Playwright 只能|最安全/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.comparison-table td::before/);
  assert.match(styles, /content: attr\(data-label\)/);
  assert.match(styles, /\.js \.compare-navigation\[data-open='true'\]/);
  assert.doesNotMatch(styles, /overflow-x:\s*hidden/);
  assert.match(script, /document\.documentElement\.classList\.add\('js'\)/);
  assert.match(script, /event\.key !== 'Escape'/);
  assert.match(sitemap, /https:\/\/f-loat\.github\.io\/panerelay\/compare\//);
  assert.match(sitemap, /https:\/\/f-loat\.github\.io\/panerelay\/zh-CN\/compare\//);
  assert.match(viteConfig, /compare: resolve\(websiteRoot, 'compare\/index\.html'\)/);
  assert.match(viteConfig, /compareZhCn: resolve\(websiteRoot, 'zh-CN\/compare\/index\.html'\)/);
});

test('unified Agent Skill keeps upstream installation and user authorization explicit', async () => {
  const skill = await read('../../skills/panerelay-browser/SKILL.md');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(packageJson.dependencies.gsap.startsWith('^3.'), true);
  assert.match(skill, /https:\/\/agent-browser\.dev\/installation/);
  assert.match(skill, /https:\/\/docs\.browser-use\.com\/open-source\/browser-use-cli/);
  assert.match(skill, /https:\/\/github\.com\/microsoft\/playwright-cli/);
  assert.match(skill, /npx --yes @panerelay\/setup --agent-browser/);
  assert.match(skill, /npx --yes @panerelay\/setup --browser-use/);
  assert.match(skill, /npx --yes @panerelay\/setup --playwright/);
  assert.match(skill, /agent-browser --session panerelay-task --provider panerelay tab list/);
  assert.match(skill, /BU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use/);
  assert.match(skill, /playwright-cli attach --cdp http:\/\/127\.0\.0\.1:43827\/cdp\/playwright/);
  assert.match(skill, /Stop for user-owned browser authorization/);
  assert.match(skill, /Do not claim completion/);
  assert.match(skill, /npx skills add F-loat\/panerelay --skill panerelay-browser/);
  await assert.rejects(read('dist/agent-setup.md'), /ENOENT/);
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
  assert.doesNotMatch(script, /document\.cookie|sessionStorage|localStorage/);
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
  const comparison = await read('dist/compare/index.html');
  const chineseComparison = await read('dist/zh-CN/compare/index.html');
  const manifest = await read('dist/site.webmanifest');
  const robots = await read('dist/robots.txt');
  const workflow = await read('../../.github/workflows/pages.yml');
  const socialCard = await readFile(join(websiteRoot, 'dist/social-card.png'));

  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="\/assets\//);
  assert.match(html, /href="\.\/panerelay-icon\.svg"/);
  assert.match(comparison, /(?:src|href)="\.\.\/assets\//);
  assert.match(comparison, /href="\.\.\/panerelay-icon\.svg"/);
  assert.match(chineseComparison, /(?:src|href)="\.\.\/\.\.\/assets\//);
  assert.match(chineseComparison, /href="\.\.\/\.\.\/panerelay-icon\.svg"/);
  assert.match(comparison, /https:\/\/f-loat\.github\.io\/panerelay\/compare\//);
  assert.match(chineseComparison, /https:\/\/f-loat\.github\.io\/panerelay\/zh-CN\/compare\//);
  assert.match(html, /https:\/\/f-loat\.github\.io\/panerelay\/social-card\.png/);
  assert.match(manifest, /"\.\/panerelay-icon\.svg"/);
  assert.match(manifest, /"start_url":\s*"\.\/"/);
  assert.match(manifest, /"scope":\s*"\.\/"/);
  assert.deepEqual([...socialCard.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(robots, /https:\/\/f-loat\.github\.io\/panerelay\/sitemap\.xml/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
});

test('localized homepage is statically rendered, canonical, and cross-linked', async () => {
  const source = await read('index.html');
  const sitemap = await read('public/sitemap.xml');
  const viteConfig = await read('vite.config.ts');
  const english = await read('dist/index.html');
  const chinese = await read('dist/zh-CN/index.html');

  assert.match(source, /rel="canonical" href="https:\/\/f-loat\.github\.io\/panerelay\/"/);
  assert.match(sitemap, /<loc>https:\/\/f-loat\.github\.io\/panerelay\/zh-CN\/<\/loc>/);
  assert.match(viteConfig, /mainZhCn: resolve\(websiteRoot, 'zh-CN\/index\.html'\)/);
  assert.match(viteConfig, /generateLocalePages/);

  // `lang`/`hreflang` use BCP 47 tags, while `og:locale` uses Open Graph `language_TERRITORY`.
  for (const [html, canonical, languageTag, openGraphLocale] of [
    [english, 'https://f-loat.github.io/panerelay/', 'en', 'en_US'],
    [chinese, 'https://f-loat.github.io/panerelay/zh-CN/', 'zh-CN', 'zh_CN'],
  ]) {
    assert.match(html, new RegExp(`<html lang="${languageTag}"`));
    assert.match(html, new RegExp(`rel="canonical" href="${canonical}"`));
    assert.match(html, new RegExp(`property="og:url" content="${canonical}"`));
    assert.match(html, new RegExp(`property="og:locale" content="${openGraphLocale}"`));
    assert.doesNotMatch(html, new RegExp(`property="og:locale" content="${languageTag}"`));
    assert.match(html, /hreflang="en" href="https:\/\/f-loat\.github\.io\/panerelay\/"/);
    assert.match(html, /hreflang="zh-CN" href="https:\/\/f-loat\.github\.io\/panerelay\/zh-CN\/"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/f-loat\.github\.io\/panerelay\/"/);
    assert.equal((html.match(/data-language-option=/g) ?? []).length, 2);
  }

  // Chinese metadata and body copy must be present before any script runs.
  assert.match(chinese, /<title[^>]*>Panerelay — 浏览器不用换，Agent 直接上手<\/title>/);
  assert.match(
    chinese,
    /name="description"[^>]*content="Panerelay 让 AI Agent 复用 Chrome \/ Edge/,
  );
  assert.match(chinese, /property="og:title"[^>]*content="Panerelay — 浏览器不用换/);
  assert.match(chinese, /name="twitter:description"[^>]*content="复用已登录的浏览器会话。/);
  assert.match(chinese, /让 Agent 在<span>你的日常浏览器里工作。<\/span>/);
  assert.match(chinese, /授权当前标签页或全部受支持网页/);
  assert.match(chinese, /获得访问，<br>不等于获得控制。/);
  assert.doesNotMatch(chinese, /Let Agents work with/);

  // The switcher must navigate between stable locale URLs and keep the matching comparison page.
  assert.match(english, /href="\.\/zh-CN\/"[^>]*?data-language-option="zh-CN"/s);
  assert.match(english, /href="\.\/"[^>]*?data-language-option="en"[^>]*?aria-current="page"/s);
  assert.match(chinese, /href="\.\/"[^>]*?data-language-option="zh-CN"[^>]*?aria-current="page"/s);
  assert.match(chinese, /href="\.\.\/"[^>]*?data-language-option="en"/s);
  assert.equal((english.match(/href="\.\/compare\/"/g) ?? []).length, 2);
  assert.equal((chinese.match(/href="\.\/compare\/"/g) ?? []).length, 2);
});
