# SEO content map

Last reviewed: 2026-08-04

One intent maps to one canonical page. Do not create near-duplicate pages for singular/plural or minor keyword variants.

## Priority English intents

| Priority | Primary intent / phrase | Supporting phrases | Canonical page | User question answered | Evidence and internal links |
| --- | --- | --- | --- | --- | --- |
| P0 | AI agent existing Chrome | connect AI agent to existing browser; AI agent use daily Chrome | `/` | Can an Agent use the Chrome session I already run? | Installation, current/all scope, GitHub |
| P0 | AI agent use logged-in browser | reuse browser login session; browser Agent without exporting cookies | `/` | How do I keep login state in the browser? | Privacy boundary, Extension, comparison |
| P0 | Panerelay vs CDP | attach AI Agent to Chrome CDP; Chrome 136 remote debugging profile | `/compare/` | When is raw CDP enough, and what policy layer is missing? | Chrome remote-debugging source, RFC-0001 |
| P0 | Playwright extension alternative | Playwright MCP existing browser; Playwright MCP connection approval | `/compare/` | How does Panerelay differ from the Playwright Chrome Extension? | Playwright extension README, scope/control rows |
| P1 | agent-browser existing Chrome | agent-browser provider Chrome profile; agent-browser logged-in tabs | `/` plus `packages/adapters/agent-browser/README.md` | How can agent-browser operate explicitly authorized daily-browser tabs? | Provider setup, 0.33.0 compatibility |
| P1 | Browser Use existing Chrome session | Browser Use CDP existing browser; Browser Use real Chrome profile | `/compare/` plus `packages/adapters/browser-use/README.md` | Which Browser Use connection mode fits an existing session? | Browser Use CLI docs, exact baseline |
| P1 | AI Agent tab authorization | browser Agent permission scope; revoke AI browser control | `/compare/` | How should access scope and active control differ? | RFC-0001, RFC-0003 |
| P2 | local-first browser automation Agent | local Chrome Agent bridge; browser automation credentials stay local | `/` | What stays local, and what does Panerelay log? | Trust section, privacy spec |

## Priority Simplified Chinese intents

| 优先级 | 主要搜索意图 / 词组 | 支持词组 | 规范页面 | 需要回答的问题 | 证据与内链 |
| --- | --- | --- | --- | --- | --- |
| P0 | AI Agent 使用现有 Chrome | AI Agent 连接现有浏览器；Agent 操作日常浏览器 | `/zh-CN/compare/` 和首页 | Agent 能否使用我正在用的 Chrome？ | 安装、授权范围、GitHub |
| P0 | AI Agent 复用浏览器登录态 | 浏览器 Agent 免重复登录；不导出 Cookie | 首页 | 如何让凭据继续留在浏览器？ | 隐私边界、扩展、对比页 |
| P0 | CDP 连接现有 Chrome | Chrome 远程调试 Agent；CDP 与浏览器扩展对比 | `/zh-CN/compare/` | 裸 CDP 解决了什么，还需要自己管理什么？ | Chrome 官方说明、RFC-0001 |
| P0 | Playwright MCP 复用登录态 | Playwright Chrome Extension；Playwright 连接确认 | `/zh-CN/compare/` | Playwright 扩展和 Panerelay 的授权模型有什么区别？ | Playwright 官方 README、对比表 |
| P1 | agent-browser 连接现有 Chrome | agent-browser 登录态；agent-browser Provider | 首页和 agent-browser README | 如何只暴露明确授权的标签页？ | Provider 设置、0.33.0 兼容记录 |
| P1 | Browser Use 使用现有浏览器 | Browser Use CDP；Browser Use Chrome Profile | 对比页和 Browser Use README | Browser Use 的不同连接模式怎么选？ | Browser Use 官方文档、兼容记录 |
| P1 | AI Agent 标签页授权 | 当前标签页授权；全部网页授权；撤销浏览器控制 | `/zh-CN/compare/` | 授权范围为什么不等于活动控制？ | RFC-0001、RFC-0003 |

## Content backlog

Create these only when search or community evidence shows recurring demand.

1. **How to let agent-browser use an existing Chrome session** — task-focused tutorial; canonical integration README remains the technical source.
2. **Raw CDP vs a browser extension for AI Agents** — architecture article explaining transport, authorization, and ownership.
3. **Tab authorization vs active control lease** — threat-model and UX explanation with current-tab/all-tabs examples.
4. **Browser Use connection modes: managed, real Chrome, CDP, or Panerelay** — neutral decision guide linked to upstream documentation.
5. **Playwright MCP existing-browser options** — persistent profile, isolated mode, CDP, official extension, and Panerelay's explicit CLI attach.
6. **AI Agent 浏览器授权怎么设计** — 中文场景化文章，覆盖后台、内容平台和多标签页任务。

## On-page rules

- Put the primary phrase naturally in the title, H1, first paragraph, and one descriptive internal link.
- Use one canonical URL and explicit English/Chinese alternates for localized comparison content.
- Answer the decision question before presenting installation calls to action.
- Link primary sources next to time-sensitive facts.
- Do not add `meta keywords`, hidden text, keyword lists, doorway pages, or repeated city/product variants.
- Keep titles descriptive rather than superlative; avoid “best,” “safest,” and “ultimate” unless the page proves a bounded claim.
- Revisit the claim register and search map after upstream connection behavior changes or at least once per release cycle.
