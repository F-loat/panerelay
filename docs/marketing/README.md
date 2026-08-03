# Panerelay marketing source of truth

This directory contains reusable launch, community, comparison, and search materials. Adapt the drafts to the actual discussion; do not post them unchanged across unrelated communities.

## Canonical position

### English

**Let AI Agents use your everyday browser—one tab or all supported tabs, your choice.**

Panerelay is an open-source local bridge that connects AI Agents and automation tools to the Chrome or Microsoft Edge session you already use. It reuses the browser's existing login state without exporting cookies. The user explicitly chooses the current tab for focused work or all supported web tabs for cross-page workflows. Authorization scope and active control are separate: control stays visible and can be released without silently widening or clearing the selected scope.

### 简体中文

**让 AI Agent 使用你常用的浏览器——授权当前页还是全部受支持网页，由你决定。**

Panerelay 是连接 AI Agent、自动化工具和现有 Chrome / Microsoft Edge 会话的开源本地桥接层。它直接复用浏览器已有登录态，不导出 Cookie。用户可以为专注任务授权当前标签页，也可以为跨页面工作授权全部受支持网页。授权范围与活动控制彼此独立：控制状态始终可见，也可以随时释放，而不会静默扩大或清除已经选择的授权范围。

## Primary audiences

1. Developers using agent-browser, Browser Use, or Playwright CLI who need sites already signed in inside their daily browser.
2. Local-Agent users who want browser automation without moving cookies, creating another credential store, or repeatedly rebuilding a profile.
3. Teams evaluating the authorization boundary between raw CDP, managed browsers, and an extension-mediated existing-browser connection.
4. People automating internal dashboards, admin consoles, research tools, and multi-site workflows where the user's existing session matters.

## Proof points

- Current-tab and all-supported-tabs authorization are both first-class user choices.
- Site permission, tab authorization, target observation, and the active control lease are separate decisions.
- Active control remains visible in the Extension and can be released immediately.
- Agent tab selection and background automation do not intentionally steal the foreground tab.
- Browser credentials remain in the browser; Panerelay does not export cookies or log page content, prompts, screenshots, credentials, or request bodies by default.
- One repository Skill covers agent-browser, Browser Use, and Playwright CLI setup and verification.
- Chrome has version-specific `Verified` evidence. Edge shares the Chromium path but remains `Forwarded` where dedicated evidence is incomplete.

## Non-goals

- Panerelay is not a replacement for managed, cloud, headless, or isolated browsers when clean profiles, proxies, browser-process ownership, or scalable remote execution are the goal.
- Panerelay does not own the user's browser process, create isolated browser contexts, change launch-time proxies, or close the user's browser.
- Panerelay does not make every browser Agent safe from prompt injection or unsafe instructions. Authorization reduces exposed scope; it does not replace task review and trustworthy Agent configuration.
- Panerelay setup does not install upstream automation tools.

## Calls to action

- Product and installation: https://f-loat.github.io/panerelay/
- Connection approach comparison: https://f-loat.github.io/panerelay/compare/
- Source: https://github.com/F-loat/panerelay
- Chrome Web Store: https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi
- Releases: https://github.com/F-loat/panerelay/releases

## Wording guardrails

Prefer:

- “Choose the current tab or all supported web tabs.”
- “Release active control without silently changing the selected authorization scope.”
- “A different connection and authorization model for existing-browser workflows.”
- “Chrome-verified; Edge remains Forwarded where dedicated evidence is pending.”

Avoid:

- “CDP always shows a confirmation popup.” Raw CDP and extension-mediated CDP are different paths.
- “Playwright can only use one tab.” The official extension starts from a selected tab, while Playwright can manage tabs after connection.
- “Panerelay is the safest browser Agent.” Safety depends on the Agent, task, site, configuration, and authorization scope.
- “Works with every browser or every Agent.” Use the checked-in compatibility records.
- “Zero risk,” “unhackable,” “undetectable,” “stealth,” or any claim that bypassing site controls is a product goal.

## Files

- [claims.md](claims.md): dated fact and inference register.
- [launch-posts.en.md](launch-posts.en.md): English launch and social variants.
- [launch-posts.zh-CN.md](launch-posts.zh-CN.md): Simplified Chinese launch and social variants.
- [community-playbook.md](community-playbook.md): autonomous operation and contextual reply guidance.
- [seo-content-map.md](seo-content-map.md): English and Chinese search-intent map.
