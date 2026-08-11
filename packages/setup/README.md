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

The base command always installs the Native Host and side-panel prerequisites. It also installs the exact same-version global `@panerelay/cli` when absent, so the recurring `panerelay` command is available. A pre-existing PATH-visible global command is preserved even when it belongs to another NVM, Volta, or npm prefix; later setup/update runs change only a version that still matches Setup's protected ownership record. Project-local `node_modules/.bin` commands do not count as global installations. Use `--no-cli` to skip this lifecycle. In an interactive terminal Setup also offers one automation-integration selector; in non-interactive use it remains engine-neutral. Setup does not manage an Agent Skill or edit shell startup files.

Agents in the side panel keep the selected project as their working directory and receive only bounded current-tab URL and title context. Panerelay-owned Codex and Claude Code processes also receive the bounded Panerelay Fetch MCP for browser-authenticated HTTP(S) requests. Automation MCP servers and Skills continue to come from the Agent's own configuration.

### Optional browser-authenticated fetch for external Agents

Codex and Claude Code have native hosted fetch/search surfaces that cannot be replaced by hooks. Panerelay can explicitly configure their supported MCP/settings surfaces so requests to known URLs use `panerelay_fetch` with the browser's login state:

```bash
npx --yes @panerelay/setup --codex-fetch
npx --yes @panerelay/setup --claude-fetch
npx --yes @panerelay/setup doctor --codex-fetch --claude-fetch
npx --yes @panerelay/setup --remove-codex-fetch
npx --yes @panerelay/setup --remove-claude-fetch
```

`--codex-fetch` registers the MCP and disables Codex hosted web search. `--claude-fetch` registers the MCP and denies Claude `WebFetch` while leaving `WebSearch` available. The matching `--remove-*-fetch` option removes only that integration. These are explicit global Agent configuration changes: base setup and the interactive automation selector do not enable them. Setup uses marked/structured Panerelay-owned entries, rejects an unmanaged `panerelay_fetch` conflict, and removal or full uninstall removes only unchanged owned entries while restoring the previous Codex web-search value. It does not install either Agent, patch a vendor runtime, accept API keys, or guarantee model tool selection.

The MCP is a generic HTTP(S) request path with exact-origin session authority and explicit Extension domain approval. It attaches applicable browser Cookies by default, rejects redirects, and never returns Cookie or storage values. Arbitrary `localStorage` access is not exposed; a built-in/site adapter may use only a protected exact-origin storage binding declared in its manifest.

### Automation tool integrations — let your Agent configure them

Install the unified Skill with the standard Agent Skills CLI:

```bash
npx skills add https://github.com/F-loat/panerelay --skill panerelay
```

Then ask the Agent to use `$panerelay`. The Skill chooses browser-authenticated Fetch or the requested automation engine and covers environment inspection, official upstream installation only when needed, selected Panerelay setup and doctor commands, a stop for user-controlled authorization, engine-specific verification, and troubleshooting.

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

### Fetch adapter lifecycle

Fetch adapters are independent from base setup and automation-engine integrations. Run base Setup first so the `panerelay` command is available; adapters are then installed only by an explicit adapter command:

```bash
npx --yes @panerelay/setup add bilibili
npx --yes @panerelay/setup add bilibili /absolute/path/to/local-adapter /absolute/path/to/source-site
npx --yes @panerelay/setup add owner/repository
npx --yes @panerelay/setup add github:owner/repository@v1.0.0#sites/example
npx --yes @panerelay/setup add 'https://github.com/owner/repository?ref=v1.0.0&path=sites/example'
npx --yes @panerelay/setup add --all
npx --yes @panerelay/setup adapters
npx --yes @panerelay/setup remove bilibili
npx --yes @panerelay/setup remove --all
```

`add` validates every source before making a batch visible. Built-in names resolve only within the lockstep `@panerelay/sites` catalog dependency. Existing local paths win over GitHub shorthand, and an unknown bare ID fails without network access. Only an explicit `owner/repository`, `github:` shorthand, or canonical `https://github.com/owner/repository` URL enables public GitHub access. Setup resolves the selected/default ref once to a full commit through the unauthenticated GitHub API, downloads its bounded HTTPS codeload archive, and records credential-free provenance. Private repositories, tokens, Git credential helpers, `git clone`, submodules, dependency installation, and repository scripts are unsupported.

A local source may be either the strict installed two-file form or an editable site-kit directory containing `panerelay.site.ts` and direct `commands/*.ts` files. Source-form adapters are built in protected temporary storage through `@panerelay/site-kit`; setup never writes generated files into the author directory and never runs colocated tests. Active files and the atomic registry are stored under `~/.panerelay/fetch-adapters` with user-only permissions. `adapters` shows recorded built-in, absolute local, or GitHub commit provenance. Re-running `add` explicitly replaces that site; `remove` changes only selected fetch-adapter records and owned version directories, not the Native Host, automation integrations, browser defaults, or conversations.

The installed form contains exactly `panerelay-fetch-adapter.json` and the self-contained `.mjs` entry named by its `entry` field. The manifest protocol is `panerelay.fetch-adapter.v3` and declares a bounded ID, name, version, description, commands, typed arguments, output fields, and examples. Installed code runs as a one-shot Node child with a minimal environment and a short-lived fetch-only Bridge credential. Local and GitHub installation are explicit trust decisions: static build, process isolation, and digest verification do not sandbox later command execution from the user's filesystem.

Create, check, test, and build a source adapter without a nested npm package:

```bash
npx --yes @panerelay/site-kit init ./example-site --id example
npx --yes @panerelay/site-kit check ./example-site
npx --yes @panerelay/site-kit test ./example-site
npx --yes @panerelay/site-kit build ./example-site --out ./example-adapter
npx --yes @panerelay/setup add ./example-site
```

Each command file exports one `defineCommand(...)` definition with literal help metadata and its handler. Relative TypeScript helpers and `node:` built-ins are supported; arbitrary package imports are rejected. Existing strict two-file adapters remain installable. When GitHub is unavailable or rate-limited, build locally and pass either source form or the two-file output as the offline fallback.

The built-in Bilibili source lives directly under `packages/sites/src/bilibili`, and `@panerelay/sites` generates and packages its two-file install artifact. It exposes 16 reads (`whoami`, `me`, `video`, `search`, `hot`, `ranking`, `dynamic`, `feed`, `feed-detail`, `favorite`, `history`, `following`, `user-videos`, `comments`, `subtitle`, and `summary`) and three writes (`comment`, `follow`, and `unfollow`). Each public command and its help metadata live in one matching file under `commands`; shared WBI/API, profile, video, dynamic, and relation helpers remain separate.

The adapter requires a logged-in browser session and Chrome site access for Bilibili. Its write requests declare a generic binding from the `bili_jct` Cookie name to the `csrf` form field. Only the Extension resolves the value; neither setup, the registry, the adapter child, Native Messaging, nor normal errors receive it. Comment requires explicit `--execute`, while follow/unfollow are idempotent and verify the resulting relation. Interactive `login` and downloader/filesystem-oriented `download` are not shipped. The CLI renders OpenCLI-style tables by default and accepts `--json` for structured output.

An unflagged interactive setup initializes its integration selector from the current protected Panerelay Provider and adapter configuration. Checked integrations are installed or updated, while unchecked integrations have only their Panerelay-owned Provider, adapter, configuration, and default artifacts removed. The upstream agent-browser, browser-use, Browser Harness, and Playwright CLI installations are never removed. The shared default answer is also initialized from current Panerelay defaults, so a later setup run reflects the state produced by the previous successful run without a separate selection cache. After the final answer, a localized timer shows that reconciliation is still running. Explicit integration flags retain additive behavior and do not remove omitted integrations.

### Explicit agent-browser integration

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup doctor --agent-browser
```

Setup verifies a compatible agent-browser executable before registering the Panerelay Provider. It does not install or update agent-browser or manage an Agent Skill. See the [agent-browser integration guide](../adapters/agent-browser/README.md) and [compatibility record](../../docs/compatibility/agent-browser-0.33.0.md).

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

The supported surfaces are the official `browser-use` CLI, `browser-use --cli-mcp`, and the Browser Use workflow in the independently installed `panerelay` Skill. Panerelay does not transparently intercept arbitrary browser-use Python SDK construction. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8; newer supported versions meet the minimum without automatically inheriting `Verified` status. See the [compatibility record](../../docs/compatibility/browser-use-0.13.7.md).

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

The independently installed `panerelay` Skill contains the Playwright workflow. See the [Playwright integration guide](../adapters/playwright/README.md) and [compatibility record](../../docs/compatibility/playwright-cli-0.1.17.md).

This connection reuses authorized tabs and does not provide isolated BrowserContexts, launch-time executable or proxy options, or browser-wide close. The fixed endpoint is loopback discovery, not a reusable browser credential.

Omitting an action runs `setup`. In an interactive terminal, the unflagged command presents the desired-state selector described above. In non-interactive use it installs only the Native Messaging host and side-panel prerequisites. Add `--agent-browser`, `--browser-use`, and/or `--playwright` to install automation integrations explicitly without removing omitted integrations. Add `--codex-fetch` or `--claude-fetch` only when the user explicitly wants the corresponding external-Agent configuration.

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
panerelay browsers
panerelay browser use chrome
# Or use an exact registration ID:
# panerelay browser use REGISTRATION_ID
panerelay browser clear
```

`@panerelay/cli` is the engine-neutral recurring command installed by normal base Setup. Setup uses npm's configured global prefix without editing shell startup files, skips an already matching Setup-owned release, and preserves any pre-existing or externally changed global installation. `--no-cli` skips this step; uninstall removes only an unchanged Setup-owned CLI unless `--keep-cli` is supplied.

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

On the first Native Host registration after an Extension background starts, the Host compares its embedded semantic release with the Extension's manifest `version_name`. Ordinary registration completes first, so a pending or failed update does not block the connection. When the Host is older, it makes one automatic attempt to run the exact base update for that Extension release. Reconnects from the same Extension background do not trigger another attempt, and a newer Host is never automatically downgraded.

The update stages and self-checks a versioned bundle, commits a protected version pointer, then closes the old Host so Chrome or Edge reconnects through the stable launcher. Only verified success restarts the Host. An unavailable exact npm package fails quietly; every failure keeps the existing Host connection usable and leaves optional integration selections and tab authorization unchanged. To replace it manually, run:

```bash
npx --yes @panerelay/setup@<extension-version> update --yes
npx --yes @panerelay/setup doctor
```

`doctor` checks the stable launcher, protected current-version pointer, selected bundle and embedded release, update lock, Native Messaging manifests, and Windows Chrome/Edge registrations without triggering an update. Pre-`panerelay.relay.v2` installations are intentionally not migrated; replace them with a clean setup.

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix Extension and package versions. Native Messaging installation supports Chrome and Edge on macOS, Linux, and current-user Windows without administrator privileges. Windows doctor reports each browser's registration independently. agent-browser 0.33.0 or newer is required only with `--agent-browser`, and its detected version appears only in `doctor --agent-browser`.

Claude Code, Qoder, and OpenCode are optional. Setup discovers `claude`, a compatible `qodercli --acp`, and `opencode acp`, then exposes available providers alongside Codex. A missing optional runtime is reported as a warning and does not make the core installation unhealthy. OpenCode authentication and permission policy remain user-owned; run `opencode auth login` and configure OpenCode actions as `ask` when Side Panel approvals are required.
