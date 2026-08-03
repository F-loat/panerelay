# Panerelay

English ｜ [简体中文](README.zh-CN.md)

[Website](https://f-loat.github.io/panerelay/) · [Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) · [Documentation](docs/README.md) · [Releases](https://github.com/F-loat/panerelay/releases)

**Let Agents use your everyday browser—one tab or all supported tabs, your choice.**

Panerelay is an open-source local bridge between AI Agents and your existing Chrome or Microsoft Edge session. Authorize the current tab for focused work or all supported web tabs for cross-page workflows; your browser profile, cookies, and signed-in state stay in the browser.

- **Choose the authorization scope.** Keep an Agent on the current tab or let it work across all supported web tabs.
- **Reuse signed-in sessions.** Work in the sites and accounts already open in your daily browser—without exporting cookies or logging in again.
- **Stay in your flow.** Agent tab selection and background automation do not switch the tab you are viewing.
- **Keep authority visible.** Active control stays visible and can be released without silently changing the authorization scope you selected.

Panerelay supports two ways to work:

| Direction | Use it when | Experience |
| --- | --- | --- |
| **Agent side panel** | You want a local Agent beside the current page | Open Codex, Claude Code, or Qoder in the side panel for conversations, approvals, activity, and tab-linked workspaces |
| **Automation tool integrations** | You want an Agent in another app or terminal to operate the browser | Connect [agent-browser](https://agent-browser.dev/) or [browser-use](https://docs.browser-use.com/open-source/browser-use-cli), or explicitly attach Playwright CLI, to authorized tabs in your existing browser |

![Panerelay](https://github.com/user-attachments/assets/2eba77ae-5362-4803-9190-cf134dd2b8d7)

## Quickstart

Requirements: Chrome or Microsoft Edge on macOS, Linux, or Windows, plus Node.js 20 or newer.

### 1. Install the Extension

Add [Panerelay from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi). Microsoft Edge may first ask you to allow extensions from other stores.

### 2. Install the Panerelay Skill

Install the unified Skill into the Agent you use:

```bash
npx skills add F-loat/panerelay --skill panerelay-browser
```

Then ask the Agent to use `$panerelay-browser` with agent-browser, Browser Use, or Playwright CLI. The Skill inspects the environment, installs or repairs only the selected upstream tool when needed, manages the matching Panerelay integration through setup, runs doctor, and pauses when you need to authorize a tab in the Extension.

From then on, tell the Agent what browser task to do and which engine to use; it will invoke `$panerelay-browser` and pause when the Extension needs your authorization.

## How it works

```text
External Agent ─┬─ agent-browser CLI / MCP ─┐
                ├─ browser-use CLI / MCP ───┤
                └─ Playwright CLI / CDP ────┤
                                            ▼
                                     Panerelay Bridge
                                            ↕ Native Messaging
Local Agent ← browser side panel ← Panerelay Extension ↔ Authorized tabs
```

- Automation tools retain their commands, helpers, waits, and page-state semantics.
- The local Bridge routes requests and enforces policy between tools, local Agent runtimes, and the Extension.
- The Extension owns user authorization, controlled-state visibility, and release. It does not store model credentials or start native Agent processes.

## Advanced setup and installation management

<details>
<summary>Show advanced setup, manual use, and management commands</summary>

### Run setup yourself

Base setup installs the Native Host required by the side panel:

```bash
npx --yes @panerelay/setup
```

In an interactive terminal it presents one keyboard multiselect for agent-browser, Browser Use, and Playwright CLI, then asks at most once whether the selected agent-browser/Browser Use integrations should become user defaults. Playwright always remains explicit.

For automation or a specific repair, use flags directly:

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --agent-browser --browser-use --playwright
```

Setup continues to probe the selected programs and manage Panerelay-owned Provider/adapter files, Browser Use environment, and supported defaults. It does not install third-party automation tools, change `PATH`, or manage the Skill.

### Authorize and verify tabs

Open Panerelay from the browser toolbar and choose the current web tab for focused work or all supported web tabs for cross-page work. Release ends active control without clearing the selected authorization scope; select that scope again when you want to clear authorization. Focus never grants authorization.

For agent-browser, the shortest boundary check is:

```bash
agent-browser --provider panerelay tab list
```

It must list only the tabs you authorized. An empty list means no eligible tab is currently authorized; it does not necessarily mean installation failed.

For Browser Use, run the official CLI directly with the fixed Panerelay discovery URL:

```bash
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use browser-use <<'PY'
print(list_tabs())
PY
```

PowerShell:

```powershell
$env:BU_CDP_URL = 'http://127.0.0.1:43827/cdp/browser-use'
@'
print(list_tabs())
'@ | browser-use
```

Command Prompt:

```bat
set "BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use"
echo print(list_tabs()) | browser-use
```

The result must likewise contain only explicitly authorized tabs. On Windows or when browser-use is not on `PATH`, invoke its official executable path; setup does not replace it or modify `PATH`.

In Extension mode, the managed environment contains the fixed discovery URL:

```dotenv
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use
```

`browser-use` and `browser-use --cli-mcp` read this variable directly. It is only a stable loopback discovery address; Panerelay selects the saved browser and creates a short-lived CDP connection behind it. Use one of these commands to change the durable mode:

```bash
panerelay connection use browser-use extension
panerelay connection use browser-use direct
```

After saving Extension mode, the explicit `BU_CDP_URL=` prefix can be omitted. Direct mode removes Panerelay-managed keys, while an explicitly supplied process environment always takes precedence.

For Playwright CLI, first install version 0.1.17 or newer from the [upstream project](https://github.com/microsoft/playwright-cli). See the [Playwright integration guide](packages/playwright/README.md), then attach explicitly:

```bash
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --playwright
playwright-cli attach --cdp http://127.0.0.1:43827/cdp/playwright
playwright-cli tab-list
playwright-cli tab-select <tab-id-from-tab-list>
playwright-cli tab-list
playwright-cli snapshot
```

Choose the intended authorized tab ID from the first `tab-list` result. After `tab-select`, run `tab-list` again and confirm the intended tab is selected before continuing. Panerelay does not install a shim or set Playwright as the default connection. Use the CLI's normal session option when you need more than one named session.

### Manage or troubleshoot the Skill

```bash
npx skills add F-loat/panerelay --skill panerelay-browser
npx skills update panerelay-browser
npx skills remove panerelay-browser
```

Use `--global` with the matching `npx skills` command when you chose a user-level installation. If an Agent cannot load the Skill, first verify its selected Agent and scope; if an automation command is missing, follow that tool's official installation source. The Skill contains the complete layered troubleshooting flow for the Skill, each upstream executable, setup/doctor, Extension connection, and browser authorization.

### Manage Panerelay itself

These commands manage the Panerelay installation:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

When more than one Panerelay browser is connected, choose a default in Extension settings or use the optional administration CLI:

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use edge
```

An unavailable saved browser or an ambiguous choice fails closed instead of following focus or registration order. Advanced integration flags, Provider defaults, custom Extension IDs, browser-use modes, and platform-specific paths are documented in the [`@panerelay/setup` reference](packages/setup/README.md).

</details>

## Safety and operating boundaries

- Reusing login state means operating inside an authorized existing tab. Panerelay does not export or log cookies, credentials, prompts, screenshots, page content, or request bodies by default.
- Mutating actions require the current exclusive control lease. Releasing control does not silently widen or remove the selected authorization scope.
- Panerelay does not own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's browser process.
- `webNavigation` is used only to recognize browser-reported related tabs for conversation context. It does not read browsing history or grant site access.
- The Extension, protocol, Bridge, Providers and adapters, setup package, browser registry, and optional administration CLI are released as one lockstep compatibility unit.

## Development and release checks

Workspace development requires Node.js 20.19 or newer and pnpm:

```bash
pnpm install
pnpm run check
```

Run `pnpm run dev`, then load `apps/extension/dist` as an unpacked Extension in Chrome or Edge. For local agent-browser Provider testing:

```bash
pnpm build
node packages/setup/dist/cli.js --agent-browser --global-default
agent-browser --provider panerelay tab list
```

Build and validate unpublished candidates with:

```bash
pnpm package
pnpm run release:check
pnpm run release:pack
```

These commands create ignored local artifacts; they do not publish packages, create tags, or upload assets. See the [release checklist](docs/releasing.md) and [RFCs](docs/rfcs).

## License

[MIT](LICENSE)
