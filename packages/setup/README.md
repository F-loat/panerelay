# @panerelay/setup

Install, update, diagnose, and remove Panerelay's local components. The base command is automation-engine neutral; agent-browser, browser-use, and Playwright CLI integrations are explicit choices.

## Start here

First install the official [Panerelay Extension from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Microsoft Edge. Edge may ask you to allow extensions from other stores.

### Panerelay only — Agent side panel

Run the engine-neutral command when you need the side panel and local Agent providers:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
```

The base command always installs the Native Host and side-panel prerequisites. In an interactive terminal it also offers one automation-integration selector; in non-interactive use it remains engine-neutral. Setup does not manage an Agent Skill or change `PATH`.

Agents in the side panel keep the selected project as their working directory and receive only bounded current-tab URL and title context. Browser MCP servers and Skills continue to come from the Agent's own configuration.

### Automation tool integrations — let your Agent configure them

Install the unified Skill with the standard Agent Skills CLI:

```bash
npx skills add F-loat/panerelay --skill panerelay-browser
```

Then ask the Agent to use `$panerelay-browser` with the engine you want. The Skill covers environment inspection, official upstream installation only when needed, selected Panerelay setup and doctor commands, a stop for user-controlled tab authorization, engine-specific verification, and troubleshooting.

Skill installation, scope, updates, and removal are owned by `npx skills`. Setup does not inspect Agent Skill directories or remove independently installed Skills.

`@panerelay/setup` does not install, update, downgrade, or rewrite agent-browser, browser-use, or Playwright CLI. It verifies an existing supported installation before adding the selected Panerelay-owned integration files.

### Authorize and verify

Open Panerelay from the browser toolbar and choose the current tab for focused work or all supported web tabs for cross-page workflows. Every path requires an explicit scope choice in the Extension. Releasing active control preserves that choice; Setup, Provider defaults, browser-use mode, browser selection, and focus never grant access to a tab.

Run the doctor command with the same integration flags used during setup. A healthy installation requires the selected checks to pass; an empty agent-browser tab list is expected until the user authorizes an eligible tab.

## Technical CLI reference

Panerelay components are published in lockstep. Use the same version as the Panerelay Extension:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall --yes
```

An unflagged interactive setup initializes its integration selector from the current protected Panerelay Provider and adapter configuration. Checked integrations are installed or updated, while unchecked integrations have only their Panerelay-owned Provider, adapter, configuration, and default artifacts removed. The upstream agent-browser, browser-use, Browser Harness, and Playwright CLI installations are never removed. The shared default answer is also initialized from current Panerelay defaults, so a later setup run reflects the state produced by the previous successful run without a separate selection cache. After the final answer, a localized timer shows that reconciliation is still running. Explicit integration flags retain additive behavior and do not remove omitted integrations.

### Explicit agent-browser integration

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup doctor --agent-browser
```

Setup verifies a compatible agent-browser executable before registering the Panerelay Provider. It does not install or update agent-browser or manage an Agent Skill. See the [agent-browser integration guide](../agent-browser/README.md) and [compatibility record](../../docs/compatibility/agent-browser-0.33.0.md).

### Explicit browser-use integration

browser-use `0.13.7` or newer can use the existing Chrome session through an opt-in Extension-backed lane:

```bash
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Setup does not install, upgrade, downgrade, or rewrite browser-use. It verifies the installed versions, configures the Panerelay Browser Use gateway and Browser Harness environment default, and records the exact compatible executable for diagnostics without changing `PATH` or any Agent Skill. Setup initially saves Extension mode. If the browser-use environment is incomplete, setup asks the user to repair or upgrade browser-use as one installation.

The key environment entry is:

```dotenv
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use
```

Setup writes it to Browser Harness's user-scoped environment file. The official `browser-use` CLI and `browser-use --cli-mcp` read it directly; no `panerelay-browser-use` or `panerelay run browser-use` wrapper is required. The URL is a fixed local discovery address. Panerelay still selects the saved browser and mints a short-lived CDP connection behind it, so this value is not a reusable browser credential. `panerelay connection use browser-use direct` removes Panerelay-managed Browser Harness keys and restores Browser Use's normal discovery behavior. An explicitly supplied process environment takes precedence over the managed file. Panerelay leaves Browser Harness's runtime and temporary-directory defaults unchanged so the official CLI and daemon resolve the same IPC endpoint.

The explicit `BU_CDP_URL=` prefix is a one-process override. After saving Extension mode, it can be omitted. Do not set Browser Harness's higher-priority `BU_CDP_WS` at the same time.

The supported surfaces are the official `browser-use` CLI, `browser-use --cli-mcp`, and the Browser Use workflow in the independently installed `panerelay-browser` Skill. Panerelay does not transparently intercept arbitrary browser-use Python SDK construction. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8; newer supported versions meet the minimum without automatically inheriting `Verified` status. See the [compatibility record](../../docs/compatibility/browser-use-0.13.7.md).

The base CLI controls the durable Browser Use mode:

```bash
panerelay connection use browser-use extension
panerelay connection use browser-use direct
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use browser-use <<'PY'
print(page_info())
PY
```

These paths are POSIX examples. A healthy Extension-mode browser-use daemon persists and is reused after the command exits. Sequential Agents share its current-page state; simultaneous canonical runs are serialized or fail busy. User release, authorization loss, Extension/Native Host disconnect, or WebSocket loss removes browser authority even if the detached browser-use process remains alive.

The integration disables browser-use telemetry and automatic recording for this lane. Browser Harness keeps its daemon state in its normal user-scoped storage, while full Panerelay uninstall removes the owned adapter, mode, configuration, and gateway state without touching independently managed Skills; it does not kill processes by a broad command-line pattern.

### Explicit Playwright CLI integration

Playwright CLI `0.1.17` or newer can attach to authorized existing Chrome or Microsoft Edge tabs through a separate opt-in CDP lane. Chrome is the verified baseline; Edge remains `Forwarded` pending its complete command matrix:

```bash
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --playwright
playwright-cli attach --cdp http://127.0.0.1:43827/cdp/playwright
playwright-cli tab-list
playwright-cli tab-select <tab-id-from-tab-list>
playwright-cli tab-list
playwright-cli snapshot
```

Choose the intended authorized tab ID from the first `tab-list` result. After `tab-select`, run `tab-list` again and confirm the intended tab is selected before continuing.

Setup verifies the upstream executable and registers only Panerelay-owned adapter metadata. It does not install a shim, modify `PATH` or shell startup files, write user-owned Playwright configuration, or set Playwright as a default. Users who want persistent explicit configuration may set `PLAYWRIGHT_MCP_CDP_ENDPOINT` or manage their own `.playwright/cli.config.json`.

The independently installed `panerelay-browser` Skill contains the Playwright workflow. See the [Playwright integration guide](../playwright/README.md) and [compatibility record](../../docs/compatibility/playwright-cli-0.1.17.md).

This connection reuses authorized tabs and does not provide isolated BrowserContexts, launch-time executable or proxy options, or browser-wide close. The fixed endpoint is loopback discovery, not a reusable browser credential.

Omitting an action runs `setup`. In an interactive terminal, the unflagged command presents the desired-state selector described above. In non-interactive use it installs only the Native Messaging host and side-panel prerequisites. Add `--agent-browser`, `--browser-use`, and/or `--playwright` to install integrations explicitly without removing omitted integrations.

```bash
npx --yes @panerelay/setup --agent-browser --browser-use
npx --yes @panerelay/setup --playwright
```

Use Panerelay explicitly:

```bash
agent-browser --provider panerelay tab list
```

When Chrome and Edge are both connected, inspect or save the browser used by unscoped Provider invocations:

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use chrome
# Or use an exact registration ID:
# npx --yes @panerelay/cli browser use REGISTRATION_ID
npx --yes @panerelay/cli browser clear
```

`@panerelay/cli` is an optional, engine-neutral administration package. Install it globally when a persistent `panerelay` command is useful. Setup does not install it globally or modify the shell `PATH`.

`PANERELAY_BROWSER_ID` selects one exact registration for a process. `PANERELAY_BROWSER` accepts an exact ID or an unambiguous browser family. Explicit selection wins over the saved browser default. Without either, Panerelay selects only when exactly one CDP-ready browser is live; ambiguity and unavailable defaults fail closed. Existing sessions remain pinned to the browser through which they were created.

Or choose the user-level default for the selected integration:

```bash
# agent-browser Provider and/or Browser Use
npx --yes @panerelay/setup --agent-browser --browser-use --global-default
```

The corresponding doctor flags verify the requested user-level defaults:

```bash
npx --yes @panerelay/setup doctor --agent-browser --browser-use --global-default
```

Human-readable setup output follows the system language when it resolves to Chinese or English. Override it per command with `--lang zh-CN` or `--lang en`, or set `PANERELAY_LANG`. The machine-readable `doctor --json` schema and values remain stable.

Browser authorization remains controlled by the user in the Panerelay side panel. Provider and browser-default configuration cannot grant access to a tab or widen its authorization scope. An Agent running in the side panel explicitly uses the browser containing that panel rather than the saved default.

Official Extension artifacts use ID `panplnkjlkoceaonlmpdekjphgmbggmi`. Self-built or differently signed Extensions can use:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

`PANERELAY_EXTENSION_ID` is the environment alternative. CLI input takes precedence over the environment, then the persisted installation ID, then the official default. The value must contain exactly 32 lowercase letters from `a` through `p`. Update preserves a persisted custom ID unless a new CLI or environment override is supplied; use the same option with `doctor` to diagnose an intentional replacement.

`update` is an alias of `setup` and replaces only the Panerelay-managed files selected by the same explicit flags:

```bash
npx --yes @panerelay/setup update --agent-browser --browser-use --global-default
```

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix Extension and package versions. Native Messaging installation supports Chrome and Edge on macOS, Linux, and current-user Windows without administrator privileges. Windows doctor reports each browser's registration independently. agent-browser 0.33.0 or newer is required only with `--agent-browser`, and its detected version appears only in `doctor --agent-browser`.

Claude Code, Qoder, and OpenCode are optional. Setup discovers `claude`, a compatible `qodercli --acp`, and `opencode acp`, then exposes available providers alongside Codex. A missing optional runtime is reported as a warning and does not make the core installation unhealthy. OpenCode authentication and permission policy remain user-owned; run `opencode auth login` and configure OpenCode actions as `ask` when Side Panel approvals are required.
