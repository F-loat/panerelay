# English launch drafts

Replace only facts that have changed, choose one primary link, verify every referenced route is deployed and returns HTTP 200, and disclose that you maintain Panerelay. Do not post every version to multiple communities on the same day.

## Show HN

**Title**

Show HN: Panerelay – Let AI agents use the Chrome session you already use

**Body**

I built Panerelay because the browser environment I wanted an Agent to use was usually the one already open on my desktop—not another clean profile.

Panerelay is an MIT-licensed local bridge between AI Agents and an existing Chrome or Microsoft Edge session. It currently connects agent-browser, Browser Use, and Playwright CLI through one repository Skill.

The important part is the authorization model:

- choose the current tab for a focused task, or all supported web tabs for a cross-page workflow;
- keep that authorization scope separate from the temporary active-control lease;
- see when external control is active and release it from the Extension;
- keep cookies and credentials in the browser instead of exporting them to the Agent.

Panerelay deliberately does not try to own the browser process, create isolated contexts, change launch-time proxies, or replace the automation engine. Managed or isolated browsers are still the better fit when a clean environment or remote scale is what you need.

The normal setup is the Chrome Extension plus one Agent Skill:

`npx skills add F-loat/panerelay --skill panerelay-browser`

Website: https://f-loat.github.io/panerelay/

Connection comparison: https://f-loat.github.io/panerelay/compare/

Source: https://github.com/F-loat/panerelay

I would especially value feedback on the current-tab/all-tabs scope choice and on workflows where reusing the daily browser is more useful than launching a clean one.

## Reddit: AI Agents / local-first / browser automation

**Suggested title**

I built a local bridge so AI Agents can use one tab—or all authorized tabs—in your existing Chrome

**Body**

Disclosure: I maintain Panerelay.

I kept hitting the same gap in browser automation: the Agent could launch a browser, but the useful session—signed-in sites, open tabs, extensions, and the state I was already working in—lived in my everyday Chrome.

Panerelay connects supported Agent tools to that existing session. The user can authorize only the current tab or all supported web tabs. That authorization remains separate from active control, which stays visible and can be released from the Extension.

It works with agent-browser, Browser Use, and Playwright CLI through a unified Agent Skill. It does not export cookies, replace those tools' automation semantics, or claim ownership of the browser process.

This is not meant to replace cloud/headless/isolated browsers. It is for the case where the existing logged-in browser is the environment you actually want.

Demo and setup: https://f-loat.github.io/panerelay/

Approach comparison: https://f-loat.github.io/panerelay/compare/

GitHub: https://github.com/F-loat/panerelay

What browser workflow would you trust to a current-tab scope but not an all-tabs scope?

## Developer community / GitHub Discussion

**Title**

Panerelay: a policy boundary between browser automation tools and an existing Chrome session

**Body**

Panerelay is an open-source Extension + local Bridge for connecting agent-browser, Browser Use, and Playwright CLI to tabs in the Chrome or Edge session a user already runs.

The implementation keeps four states distinct:

1. Chrome site permission;
2. user-selected tab scope (current tab or all supported web tabs);
3. observable target attachment;
4. the current lease required for mutating control.

Focus never grants authorization. Release ends active control without silently widening or clearing the selected scope. Automation commands and waits remain owned by the upstream engine; the Bridge is the routing and policy boundary.

The architecture and version-specific evidence are published in the repository:

- RFCs: https://github.com/F-loat/panerelay/tree/main/docs/rfcs
- compatibility: https://github.com/F-loat/panerelay/tree/main/docs/compatibility
- connection comparison: https://f-loat.github.io/panerelay/compare/

I maintain the project and would welcome review of the authorization and revocation model, especially from people who have operated raw CDP or extension-backed browser connections.

## LinkedIn / professional network

Most AI browser workflows start by launching a new browser. That is useful for testing and isolation—but often the browser you actually need is already open, already signed in, and already holding the tabs where work is happening.

I built Panerelay for that second case.

Panerelay is an open-source local bridge that lets supported AI Agents use an existing Chrome or Edge session. The user chooses the authorization scope: the current tab for focused work, or all supported web tabs for cross-page workflows. Active control remains a separate, visible, releasable state.

It currently integrates with agent-browser, Browser Use, and Playwright CLI while leaving their automation behavior intact. Cookies and credentials stay in the browser, and Panerelay does not take ownership of the browser process.

The new comparison page explains when Panerelay, raw CDP, a managed browser, or the Playwright Chrome Extension is the better fit:

https://f-loat.github.io/panerelay/compare/

Source and setup:

https://github.com/F-loat/panerelay

#opensource #AIAgents #BrowserAutomation #LocalFirst

## X thread

**1/6**

AI Agents often launch a clean browser. But the useful session—your logins, open tabs, and extensions—is usually in the Chrome window you already use.

I built Panerelay for that case. 🧵

**2/6**

Panerelay is an open-source local bridge for agent-browser, Browser Use, and Playwright CLI.

It connects those tools to your existing Chrome or Edge session without exporting cookies.

**3/6**

The key difference is scope:

• authorize the current tab for focused work • or all supported web tabs for cross-page workflows

Focus alone never grants access.

**4/6**

Authorization and control are separate.

The Extension shows active external control and lets you release it without silently changing the scope you selected.

**5/6**

Panerelay is not a universal replacement for managed/headless browsers. If you need clean profiles, proxies, or remote scale, use the tool built for that.

It is for workflows where the daily browser is the desired environment.

**6/6**

Website: https://f-loat.github.io/panerelay/

Compare connection approaches: https://f-loat.github.io/panerelay/compare/

GitHub: https://github.com/F-loat/panerelay

MIT licensed. Feedback welcome.

## Compact single posts

**Product hook**

Your AI Agent does not always need another browser. Panerelay lets agent-browser, Browser Use, and Playwright CLI work in your existing Chrome/Edge session—with current-tab or all-supported-tabs authorization and visible, releasable control. https://f-loat.github.io/panerelay/

**Technical hook**

Raw CDP is a transport. Panerelay adds a user-facing policy layer for an existing browser: explicit tab scope, opaque target routing, visible control lease, and immediate release—without replacing the automation engine. https://f-loat.github.io/panerelay/compare/
