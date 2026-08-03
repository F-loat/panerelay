# Community operation playbook

This playbook applies to manual work and the hourly Panerelay promotion automation.

## Operating mode

- Review opportunities hourly; do not publish hourly by default.
- Publish or reply only when Panerelay directly addresses the discussion and the response contains useful information even if the link is removed.
- Confirm every referenced route is deployed and returns HTTP 200 before publishing; never promote an unshipped comparison page or article.
- Default public-interaction ceiling: 3 actions per day across all communities.
- Do not reply twice to the same discussion unless another participant continues the conversation.
- Use existing signed-in sessions only. Stop and report if login, CAPTCHA, paid access, private-group admission, rate limits, or identity verification blocks the action.
- Never send a private message to a stranger, make a commercial promise, accept terms on the user's behalf, or disclose non-public information without specific approval.

## Existing promotion to avoid duplicating

- Reddit r/SideProject: https://www.reddit.com/r/SideProject/comments/1vbkveq/panerelay_let_ai_agents_work_in_the_chrome/
- Reddit r/vercel: https://www.reddit.com/r/vercel/comments/1vatmcn/i_built_a_local_provider_that_lets_agentbrowser/

Prefer a substantive update or a reply to a new question over reposting the same announcement in those communities.

## Opportunity score

Act only when the total is at least 7/10.

| Signal | Score |
| --- | --: |
| Author explicitly needs an existing logged-in browser | +3 |
| Discussion mentions agent-browser, Browser Use, Playwright MCP/CLI, CDP, Codex, Claude Code, or Qoder | +2 |
| Current-tab/all-tabs scope or revocation answers a stated concern | +2 |
| A reproducible Panerelay example or source link answers the question | +2 |
| Project maintainer participation is allowed and can be disclosed | +1 |
| Thread prohibits promotion, is unrelated, or is primarily emotional/controversial | stop |
| Reply would be substantially the same as a recent Panerelay post | -3 |
| Claim requires unrecorded compatibility or private evidence | stop |

## Reply structure

1. Answer the question before naming the project.
2. State the relevant trade-off or limitation.
3. Disclose: “I maintain Panerelay” / “我是 Panerelay 维护者”.
4. Explain exactly why it is relevant to this thread.
5. Link to one resource: comparison for approach questions, compatibility for technical claims, website for setup.
6. End with a useful question only when genuine feedback would change the project.

## Contextual reply patterns

### Fresh browser loses login state

The clean browser is useful for isolation, but it is the wrong environment when the task depends on the session already open in daily Chrome. One alternative is an extension-mediated connection that keeps credentials in the browser and exposes only a user-selected scope. I maintain Panerelay, which supports current-tab or all-supported-tabs authorization for agent-browser, Browser Use, and Playwright CLI. The trade-offs versus raw CDP and managed browsers are here: https://f-loat.github.io/panerelay/compare/

### Raw CDP attachment discussion

CDP solves the transport, but it does not by itself define a user-facing authorization and revocation model. Chrome 136 also changed how remote-debugging switches interact with the default data directory. If the requirement is explicit tab scope in an already-running daily browser, that policy layer needs to live somewhere above CDP. I maintain Panerelay, which is one implementation of that layer: https://f-loat.github.io/panerelay/compare/

### Playwright Extension comparison

The Playwright Extension is a good fit when the desired engine is Playwright MCP and the user wants to connect from a selected existing tab. Its documentation also supports a token to avoid repeated connection approval. Panerelay targets a different shape: current-tab or all-supported-tabs authorization shared by agent-browser, Browser Use, and Playwright CLI, with active control exposed as a separate releasable lease. I maintain Panerelay; the source-linked comparison is here: https://f-loat.github.io/panerelay/compare/

### Browser Agent recommendation thread

The deciding question is usually not “which Agent clicks best?” but “which browser environment and authorization boundary does the workflow need?” Use a managed/isolated browser for clean state and remote scale; raw CDP when you own the debugging setup; the Playwright Extension for a Playwright-native selected-tab flow; or an explicit policy bridge when the daily browser and flexible tab scope are the requirement. I maintain one such bridge, Panerelay: https://f-loat.github.io/panerelay/compare/

### 中文：复用登录态

干净浏览器适合隔离和测试，但如果任务依赖日常 Chrome 里已经登录的后台，它反而不是正确的运行环境。另一种思路是通过扩展保留凭据在浏览器中，再让用户明确选择开放范围。我是 Panerelay 维护者，它支持授权当前标签页或全部受支持网页，并接入 agent-browser、Browser Use 和 Playwright CLI。这里有不拉踩的连接方式对比：https://f-loat.github.io/panerelay/zh-CN/compare/

### 中文：CDP 与扩展

CDP 解决的是调试传输，但不会自动提供面向用户的标签页授权、控制可见性和立即撤销。是否直接用 CDP，取决于你是否愿意自己管理浏览器启动方式、端点和暴露范围。我维护的 Panerelay 是把这层策略放在本地 Bridge 和扩展里的一种实现，详细边界和替代方案在：https://f-loat.github.io/panerelay/zh-CN/compare/

## Do not engage

- The post asks for stealth, CAPTCHA bypass, account farming, moderation evasion, or credential extraction.
- The platform or community rules prohibit project promotion in replies.
- The only contribution would be a product link.
- The thread concerns a security incident or vulnerability that has not been coordinated through the repository's security process.
- The reply would imply Panerelay has verified a browser, version, Agent, or workflow that is not in `docs/compatibility/`.

## Hourly action report

```markdown
### Promotion review — YYYY-MM-DD HH:mm TZ

- Opportunities reviewed: <count and links>
- Public actions: <none, or link + exact posted text>
- Why each action passed the relevance threshold: <brief evidence>
- Skipped opportunities: <link + reason>
- New SEO/content signal: <query or recurring question>
- Follow-up signal: <reply, click-independent qualitative feedback, issue, star discussion, or none>
```

Do not store cookies, screenshots, private messages, or account identifiers in the repository log.
