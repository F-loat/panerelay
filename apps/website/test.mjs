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
    'Playwright CLI can connect too.',
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
  assert.match(
    html,
    /Playwright CLI can connect too\.[\s\S]{0,1000}<code>attach<\/code>[\s\S]{0,1000}<code>playwright-cli<\/code>/,
  );
  assert.match(html, /packages\/playwright\/README\.md/);
  assert.match(
    html,
    /BU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use browser-use &lt;&lt;'PY'[\s\S]+print\(list_tabs\(\)\)/,
  );
  assert.doesNotMatch(html, /panerelay-browser-use-cli/);
  assert.doesNotMatch(html, /browser-use tab list/);
  assert.doesNotMatch(html, /await browser\./);
  assert.doesNotMatch(html, /data-copy-command="[^\"]*--(?:agent-browser|browser-use)/);
  assert.doesNotMatch(html, /waiting for your approval|You authorize this tab/);
  assert.doesNotMatch(html, /agent-setup\.md|curl -fsSL/);
  assert.doesNotMatch(i18n, /agent-setup\.md|curl -fsSL/);
  assert.match(
    html,
    /data-i18n="demo\.local\.body">\s*Work with local Agents beside this browser while keeping tab access under\s+your control\./,
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
  assert.equal((html.match(/data-copy-command=/g) ?? []).length, 1);
  assert.equal((html.match(/data-copy-text-key=/g) ?? []).length, 1);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/data-engine-tab=/g) ?? []).length, 2);
  assert.equal((html.match(/data-engine-panel=/g) ?? []).length, 2);
  assert.equal((html.match(/data-engine-(?:tab|panel)="playwright"/g) ?? []).length, 0);
  assert.match(html, /class="setup-agent-step"/);
  assert.doesNotMatch(html, /data-handoff/);
  assert.equal((html.match(/data-demo-step=/g) ?? []).length, 6);
  assert.equal((html.match(/data-demo-panel=/g) ?? []).length, 6);
  assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 8);
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
  assert.doesNotMatch(script, /HandoffChoice|handoffCommand|data-handoff/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /\.primary-navigation > \.button-small/);
  assert.match(styles, /\.primary-navigation > \.nav-github/);
  assert.match(styles, /\.language-switcher \+ \.button-small/);
  assert.match(styles, /\.engine-tabs/);
  assert.match(styles, /\.engine-panel/);
  assert.match(styles, /\.playwright-compat/);
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
  assert.match(i18n, /使用 panerelay-browser Skill，完成 agent-browser 接入并运行 doctor/);
  assert.match(i18n, /一个 Skill 覆盖三种集成/);
  assert.match(i18n, /统一 Skill 中的 Browser Harness CLI/);
  assert.match(i18n, /控制权始终看得见/);
  assert.match(i18n, /当前标签页仍保持授权；再次点击已选范围，才会取消授权/);
  assert.match(i18n, /获得访问，<br>不等于获得控制。<br><em>控制权始终可见。<\/em>/);
  assert.match(i18n, /把 agent-browser<br>接入日常标签页。/);
  assert.match(i18n, /把 browser-use<br>接入已登录的 Chrome。/);
  assert.match(i18n, /Playwright CLI 也可以接入。/);
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
