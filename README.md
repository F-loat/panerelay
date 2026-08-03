# Panerelay

English ｜ [简体中文](README.zh-CN.md)

[Website](https://f-loat.github.io/panerelay/) · [Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) · [Documentation](docs/README.md) · [Releases](https://github.com/F-loat/panerelay/releases)

**Let Agents work with the browser you already use.**

Panerelay is an open-source local bridge between AI Agents and your existing Chrome or Microsoft Edge session. It lets Agents work with the tabs you explicitly authorize while your browser profile, cookies, and signed-in state stay in the browser.

- **Reuse signed-in sessions.** Work in the sites and accounts already open in your daily browser—without exporting cookies or logging in again.
- **Stay in your flow.** Agent tab selection and background automation do not switch the tab you are viewing.
- **Keep authority visible.** Authorization is explicit, active control is visible, and release is always available.

Panerelay supports two ways to work:

| Direction | Use it when | Experience |
| --- | --- | --- |
| **Agent side panel** | You want a local Agent beside the current page | Open Codex, Claude Code, or Qoder in the side panel for conversations, approvals, activity, and tab-linked workspaces |
| **Automation tool integrations** | You want an Agent in another app or terminal to operate the browser | Connect [agent-browser](https://agent-browser.dev/) or [browser-use](https://docs.browser-use.com/open-source/browser-use-cli), or connect both tools, to authorized tabs in your existing browser |

![Panerelay](https://github.com/user-attachments/assets/8873dd53-ee16-484a-b801-66622ebe61ad)

## Quickstart

Requirements: Chrome or Microsoft Edge on macOS, Linux, or Windows, plus Node.js 20 or newer. Panerelay itself does not require agent-browser or browser-use. Browser Use integration requires browser-use 0.13.7+ with Browser Harness 0.1.8+.

### 1. Install the Extension

Add [Panerelay from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi). Microsoft Edge may first ask you to allow extensions from other stores.

### 2. Connect Panerelay

Choose the setup path that matches how you want to work.

#### Let your Agent handle browser automation setup

Copy one instruction into the Agent you already use. The Agent will inspect the environment, install or update the selected upstream tool from its official source only when needed, install the Panerelay integration, run diagnostics, and stop when your action is required.

**agent-browser**

```text
Fetch this guide with curl -fsSL and follow the agent-browser scenario: https://f-loat.github.io/panerelay/agent-setup.md
```

**browser-use**

```text
Fetch this guide with curl -fsSL and follow the browser-use scenario: https://f-loat.github.io/panerelay/agent-setup.md
```

The published guide is generated from the version-controlled [Agent setup instructions](docs/agent-setup.md). `@panerelay/setup` installs Panerelay-owned files; it does not install or modify agent-browser or browser-use itself.

#### Install Panerelay yourself

```bash
npx --yes @panerelay/setup
```

This command installs the Native Host required by the side panel and Panerelay integrations, then interactively asks whether to connect optional automation engines.

### 3. Authorize the tabs you want to share

Open Panerelay from the browser toolbar and choose the current web tab or all supported web tabs.

### 4. Start working

- In the **Agent side panel**, select an installed and signed-in Codex, Claude Code, or Qoder, optionally choose a project directory, and start a conversation.
- With **agent-browser or browser-use**, run the tool as usual. Panerelay supplies the authorized existing-browser connection.

For agent-browser, this is the shortest authorization check:

```bash
agent-browser --provider panerelay tab list
```

It must list only the tabs you authorized. An empty list means no eligible tab is currently authorized; it does not necessarily mean installation failed.

For browser-use, run its pre-imported helpers through the setup-managed launcher printed during installation. This POSIX example uses the default launcher path:

```bash
~/.panerelay/bin/panerelay-browser-use <<'PY'
print(list_tabs())
PY
```

The result must likewise contain only explicitly authorized tabs. On Windows or when browser-use is installed at a nonstandard path, use the exact launcher and executable paths printed by setup.

## Supported workflows

### Agent side panel

The side panel supports local Codex, Claude Code, and Qoder runtimes when they are installed and signed in. The selected project remains the Agent's working directory. Panerelay supplies only bounded current-tab URL and title context; browser MCP servers and Skills continue to come from the Agent's own configuration.

### agent-browser integration

Panerelay provides an agent-browser Provider for authorized existing-browser tabs. Standard agent-browser CLI and MCP commands keep their normal semantics. The supported minimum and exact initial Chrome-verified baseline are both agent-browser 0.33.0. See the [integration guide](packages/agent-browser/README.md) and [compatibility record](docs/compatibility/agent-browser-0.33.0.md).

### browser-use integration

Panerelay supports the setup-managed browser-use CLI, additive Skill, and CLI MCP launcher. Browser Harness continues to own browser-use automation semantics while Panerelay supplies the authorized Chrome connection. Arbitrary browser-use Python SDK construction is not transparently intercepted and needs an explicit connection integration.

The supported minimum is browser-use 0.13.7. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8. See the [integration guide](packages/browser-use/README.md) and [compatibility record](docs/compatibility/browser-use-0.13.7.md).

Microsoft Edge capability groups remain classified as `Forwarded` until representative acceptance is complete. See the [browser platform record](docs/compatibility/browser-platforms.md).

## How it works

```text
External Agent ─┬─ agent-browser CLI / MCP ─┐
                └─ browser-use CLI / MCP ───┤
                                            ▼
                                     Panerelay Bridge
                                            ↕ Native Messaging
Local Agent ← browser side panel ← Panerelay Extension ↔ Authorized tabs
```

- Automation tools retain their commands, helpers, waits, and page-state semantics.
- The local Bridge routes requests and enforces policy between tools, local Agent runtimes, and the Extension.
- The Extension owns user authorization, controlled-state visibility, and release. It does not store model credentials or start native Agent processes.

## Manage the installation

The human-facing commands manage Panerelay itself:

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

## Safety and operating boundaries

- Reusing login state means operating inside an authorized existing tab. Panerelay does not export or log cookies, credentials, prompts, screenshots, page content, or request bodies by default.
- Mutating actions require the current exclusive control lease. Releasing control does not silently widen or remove the selected authorization scope.
- Panerelay does not own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's browser process.
- `webNavigation` is used only to recognize browser-reported related tabs for conversation context. It does not read browsing history or grant site access.
- The Extension, protocol, Bridge, Providers and adapters, setup package, browser registry, and optional administration CLI are released as one lockstep compatibility unit.

## Documentation

- [Documentation map](docs/README.md)
- [Agent setup instructions](docs/agent-setup.md)
- [`@panerelay/setup` technical reference](packages/setup/README.md)
- [Compatibility records](docs/compatibility)
- [Architecture RFCs](docs/rfcs)

## Development and release checks

Workspace development requires Node.js 20.19 or newer and pnpm:

```bash
pnpm install
pnpm run check
```

Run `pnpm run dev`, then load `apps/extension/dist` as an unpacked Extension in Chrome or Edge. For local agent-browser Provider testing:

```bash
pnpm build
node packages/setup/dist/cli.js --agent-browser --project-provider
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
