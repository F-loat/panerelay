# Panerelay

English ｜ [简体中文](README.zh-CN.md)

[Website](https://f-loat.github.io/panerelay/) · [Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) · [Releases](https://github.com/F-loat/panerelay/releases)

**Agent in Browser. Agent Use Browser.**

Panerelay is an open-source local bridge between AI agents and your existing Chrome or Microsoft Edge session. It carries browser context in both directions:

- **Agent in Browser.** Open Codex, Claude Code, or Qoder beside the current page for browser-native conversations, approvals, activity, and immediate control release.
- **Agent Use Browser.** Let an external Agent use [agent-browser](https://agent-browser.dev/), [browser-use](https://docs.browser-use.com/open-source/browser-use-cli), or both in the tabs you authorize while each tool keeps its native workflow.

Credentials stay in the browser. Panerelay works only in tabs you explicitly authorize. Agent tab selection and background automation do not switch the Chrome or Edge tab you are viewing.

![Panerelay](https://github.com/user-attachments/assets/8873dd53-ee16-484a-b801-66622ebe61ad)

## How it works

```text
Any AI Agent ─┬─ agent-browser CLI / MCP ─┐
              └─ browser-use CLI / MCP ───┤
                                          ▼
                                   Panerelay Bridge
                                          ↕ Native Messaging
Local Agents ← browser side panel ← Panerelay Extension ↔ Authorized tabs
```

- **Automation engines keep their semantics.** agent-browser and browser-use still own their commands, helpers, waits, and page state.
- **The local Bridge handles routing and policy** between automation engines, local Agent runtimes, and the Extension.
- **The Extension owns user authorization and visibility.** It does not store model credentials or start native Agent processes.

## Quickstart

Requirements: Chrome or Microsoft Edge on macOS, Linux, or Windows and Node.js 20+. Panerelay itself needs neither automation engine. agent-browser 0.33.0+ or browser-use 0.13.7+ is required only when you ask your Agent to configure that workflow.

Microsoft Edge runtime capabilities are currently classified as `Forwarded` pending complete representative acceptance. See the [browser platform compatibility record](docs/compatibility/browser-platforms.md) for the evidence boundary.

1. Install [Panerelay from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Edge. Edge may first ask you to allow extensions from other stores.
2. Install the Panerelay local integration:

   ```bash
   npx --yes @panerelay/setup
   ```

3. Open Panerelay from the Chrome or Edge toolbar and authorize the current web tab or all supported web tabs. Installation and tool selection never authorize a tab by themselves.
4. For **Agent in Browser**, select an installed, signed-in Codex, Claude Code, or Qoder and start a conversation. Panerelay keeps the selected project as the Agent working directory and supplies only bounded current-tab URL/title context; browser MCPs and Skills come from the Agent's own configuration.
5. For **Agent Use Browser**, give your Agent one of the setup prompts below.
6. If Panerelay is connected in more than one browser, use the Extension's `Default Browser` setting or select one from the CLI:

   ```bash
   npx --yes @panerelay/cli browsers
   npx --yes @panerelay/cli browser use edge
   ```

### Let your Agent configure browser automation

Copy the instruction that matches your workflow into the Agent you already use. It should inspect first, change only what is needed, and leave tab authorization to you.

**agent-browser**

```text
Set up Panerelay so my Agent can use agent-browser with my existing Chrome or Edge browser. Inspect the local environment first. Install or update agent-browser from its official source only if needed, then use Panerelay's official setup tool to enable the agent-browser integration. Run the relevant Panerelay doctor check and verify that agent-browser can list only the tabs I authorize. Do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

**browser-use**

```text
Set up Panerelay so my Agent can use browser-use with my existing signed-in Chrome browser. Inspect the local environment first. Install or update browser-use from its official source only if needed, then use Panerelay's official setup tool to enable the browser-use integration. Run the relevant Panerelay doctor check and verify the Extension-backed connection. Preserve browser-use's native workflow, do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

**Both**

```text
Set up Panerelay for both agent-browser and browser-use with my existing browser. Inspect the local environment first. Install or update each tool from its official source only if needed, then use Panerelay's official setup tool to enable both integrations together. Run the relevant doctor checks and verify each connection. Do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

Exact adapter flags and diagnostics remain available in the [`@panerelay/setup` technical reference](packages/setup/README.md).

### browser-use support boundary

Panerelay supports the setup-managed browser-use CLI, additive Skill, and CLI MCP surface.

Setup does not install or modify browser-use and does not change `PATH`. The installed Skill continues to use normal browser-use helpers through a protected private CLI, while Panerelay supplies the authenticated virtual CDP connection to explicitly authorized tabs. Direct and Extension modes have a saved Panerelay-owned preference plus one-run overrides. The private browser-use daemon is intentionally persistent and shared across sequential Agent commands; it is not per-Agent task isolation. See the [browser-use compatibility record](docs/compatibility/browser-use-0.13.7.md) for CLI, CLI MCP, lifecycle, security, and unsupported browser-ownership boundaries.

Panerelay does not transparently intercept arbitrary browser-use Python SDK construction. SDK applications need an explicit connection integration. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8; newer supported versions meet the minimum but do not automatically inherit `Verified` status.

To omit `--provider panerelay` in later commands, set Panerelay as the user-level default from Extension settings or run setup with `--global-provider`. Use `--project-provider` instead when the default should apply only to the current project. Provider selection changes routing only—it never grants browser permission or authorizes a tab.

## What Panerelay provides

- agent-browser workflows in authorized tabs: page interaction, screenshots, navigation, tabs and popups, diagnostics, network inspection, and request mocking.
- browser-use CLI, additive Skill, and CLI MCP workflows through an explicit authorized existing-Chrome integration.
- Side-panel conversations with supported local Agents, including history, approvals, interruption, activity, and tab-linked workspaces.
- User-scoped Native Messaging setup on macOS, Linux, and Windows.
- Local-first routing: no Panerelay cloud service is required.

See the [agent-browser record](docs/compatibility/agent-browser-0.33.0.md), [browser-use record](docs/compatibility/browser-use-0.13.7.md), [browser platform record](docs/compatibility/browser-platforms.md), and other [compatibility records](docs/compatibility) for exact runtime coverage.

## Manage the installation

The human-facing command manages Panerelay itself:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

Adapter-specific setup, diagnostics, and provider-default flags are documented in the [`@panerelay/setup` technical reference](packages/setup/README.md). Extension settings can set or clear Panerelay as the user-level agent-browser default without uninstalling anything.

agent-browser reads the user default from `~/.agent-browser/config.json`; the current project's `./agent-browser.json` takes precedence. To restore another default, change or remove its `provider` field. Panerelay remains installed and can always be selected with `--provider panerelay`.

Browser selection is a separate setting. Panerelay uses an explicit `PANERELAY_BROWSER_ID` or `PANERELAY_BROWSER` selector first, then the saved browser default, then the only ready browser. Multiple ready browsers without a choice fail closed instead of using focus or registration order:

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use chrome
# Or use an exact registration ID:
# npx --yes @panerelay/cli browser use REGISTRATION_ID
npx --yes @panerelay/cli browser clear
PANERELAY_BROWSER=edge agent-browser --provider panerelay tab list
```

For frequent administration, install `@panerelay/cli` globally and run the same commands as `panerelay ...`. Setup does not install this optional CLI or modify your shell `PATH`.

An explicit or saved browser that is offline does not fall back to another browser. Each agent-browser session stays pinned to its selected browser until close.

Official builds use Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`. A self-built Extension can register its own 32-character ID:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

The ID must contain 32 lowercase letters from `a` through `p`.

## Safety and operating boundaries

- Browser site permission, tab authorization, and the exclusive automation lease are separate. Focus never grants authorization; mutating actions require the current lease.
- Reusing login state means operating inside an authorized existing tab. Panerelay does not export or log cookies, credentials, prompts, screenshots, page content, or request bodies by default.
- Panerelay cannot own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's Chrome or Edge process.
- `webNavigation` is used only to recognize browser-reported related tabs so they can share conversation context. It does not read browsing history or grant site access.
- The Extension, protocol, Bridge, Providers/adapters, setup package, browser registry, optional administration CLI, and optional browser-use adapter form one lockstep compatibility unit.

## Development and release checks

Workspace development requires Node.js `20.19` or newer and pnpm:

```bash
pnpm install
pnpm run check
```

Run `pnpm run dev`, then load `apps/extension/dist` as an unpacked Extension in Chrome or Edge. For local Provider testing:

```bash
pnpm build
node packages/setup/dist/cli.js --project-provider
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
