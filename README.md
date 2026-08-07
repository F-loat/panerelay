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
| **Agent side panel** | You want a local Agent beside the current page | Open Codex, Claude Code, Qoder, or OpenCode in the side panel for conversations, approvals, activity, and tab-linked workspaces |
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

Then ask the Agent to use `$panerelay-browser` with agent-browser, Browser Use, or Playwright CLI. For an ordinary browser task, a new side-panel conversation supplies cached Panerelay integration registrations so the Skill can try the selected engine directly and pause when you need to authorize a tab. If that fast-path attempt fails, or when you explicitly ask for setup or verification, the Skill inspects the environment, installs or repairs only the selected upstream tool when needed, manages the matching Panerelay integration through setup, and runs targeted doctor checks.

A new side-panel conversation also supplies an opaque, staleable target hint for the originating tab. The Skill maps it to agent-browser's first local tab, Browser Use's exact `switch_tab` target, or Playwright's target-scoped attach and index `0`. The hint never contains Chrome's raw tab ID and never grants authorization or control; if the target is closed or unauthorized, selection fails instead of falling back to a similar URL or another tab.

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

## Browser-backed fetch

`panerelay fetch` sends a bounded Fetch-shaped request through one selected live Panerelay Extension, so the request can reuse cookies from that Chrome or Edge profile without exporting them:

```bash
panerelay fetch https://api.example.com/me \
  --method GET \
  -H 'Origin: https://www.example.com' \
  -H 'Referer: https://www.example.com/' \
  --query 'view:full' \
  --response json
```

Browser cookies are included by default; use `--no-cookies` to disable them. The raw command also supports `--data`, `--data-base64`, repeated `--header/-H` and `--query`, `--timeout`, `--response`, and `--browser`. Run `panerelay fetch --help` for the complete localized reference.

Chrome site access is still required for the target origin, but fetch does not preflight, request, or widen that permission. If Chrome rejects cookie access, temporary header setup, or the request, Panerelay reports the origin and asks you to grant site access before retrying. This first version intentionally has no Panerelay-owned domain ACL and does not acquire a tab-control lease.

Site adapters are opt-in. All built-ins ship together in the lockstep `@panerelay/sites` catalog rather than one npm package per site. Setup accepts built-ins, existing local two-file artifacts, lightweight site-kit source directories, and explicit public GitHub repositories in one atomic batch:

```bash
npx --yes @panerelay/setup add bilibili
npx --yes @panerelay/setup add ./my-site
npx --yes @panerelay/setup add owner/repository
npx --yes @panerelay/setup add github:owner/repository@v1.0.0#sites/example
npx --yes @panerelay/setup adapters
panerelay fetch bilibili --help
panerelay fetch bilibili me
panerelay fetch bilibili me --json
panerelay fetch bilibili subtitle BV1xx411c7mD --lang zh-CN
npx --yes @panerelay/setup remove bilibili
```

Installed files live under `~/.panerelay/fetch-adapters`. Help reads protected manifest metadata without opening a browser or executing adapter code. Adapter commands render an OpenCLI-style table with an item-count and elapsed-time footer by default and accept `--json` for structured output. GitHub installs are public-only, resolve to one recorded commit, and never run repository package managers or scripts. Execution verifies the installed digest, starts the adapter as a bounded one-shot child, and gives it only a short-lived fetch credential. Local and GitHub adapters are trusted code selected by the user, not an OS sandbox.

The built-in Bilibili adapter provides 16 read commands (`whoami`, `me`, `video`, `search`, `hot`, `ranking`, `dynamic`, `feed`, `feed-detail`, `favorite`, `history`, `following`, `user-videos`, `comments`, `subtitle`, and `summary`) and three writes (`comment`, `follow`, and `unfollow`). Use `panerelay fetch bilibili <command> --help` for arguments. `comment` requires `--execute`; relation writes pre-check and verify the resulting state. For all three writes, the adapter declares a `bili_jct`-to-`csrf` binding while the Extension resolves and injects the Cookie value, so the value never enters adapter input. `login` and `download` are intentionally not included because they require interactive navigation or media/filesystem behavior beyond fetch adapters.

`--lang` after a site command is an adapter argument, as in the subtitle example. Put a global locale before `fetch`, for example `panerelay --lang zh-CN fetch bilibili --help`.

Create an editable command-per-file adapter with `npx --yes @panerelay/site-kit init ./my-site --id my-site`, then use `check`, explicit `test`, and `build`. Setup can install that source directory directly without a `package.json`, `tsconfig.json`, handwritten manifest, or build script. Existing directories containing `panerelay-fetch-adapter.json` plus one self-contained `.mjs` entry remain supported. See the [`@panerelay/setup` reference](packages/setup/README.md#fetch-adapter-lifecycle) and [`@panerelay/site-kit`](packages/site-kit/README.md).

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

For Playwright CLI, first install version 0.1.17 or newer from the [upstream project](https://github.com/microsoft/playwright-cli). See the [Playwright integration guide](packages/adapters/playwright/README.md), then attach explicitly:

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

- Browser automation reuses login state inside authorized existing tabs. Browser-backed fetch instead uses Chrome site access and keeps collected cookies inside the Extension. Panerelay does not export or log cookies, credentials, prompts, screenshots, page content, or request bodies by default.
- Mutating browser-automation actions require the current exclusive control lease. Raw fetch methods use the separate fetch-only path and do not acquire that lease; the first version has no Panerelay domain policy, so callers must treat requests and installed adapters according to the target API's effects.
- Panerelay does not own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's browser process.
- `webNavigation` is used only to recognize tabs that a bound page creates as navigation targets for conversation context. Tabs created through browser chrome remain independent; the permission does not read browsing history or grant site access.
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
