# Panerelay

English ｜ [简体中文](README.zh-CN.md)

**Let AI agents work in the Chrome you already use.**

Panerelay is an open-source local bridge between AI agents and your existing Chrome session. It solves two problems while keeping browser access explicit and revocable:

1. **Let Agents work directly in your Chrome.** Any Agent that can use [agent-browser](https://github.com/vercel-labs/agent-browser) through CLI or MCP can control the tabs you authorize with your current browser profile and login state—no separate browser, repeated login, or cookie export.
2. **Bring local Agents into the Chrome side panel.** After one Panerelay setup, the Extension discovers supported local Agents and gives them a browser-native chat surface with conversation history, approvals, activity, and immediate control release.

Credentials stay in Chrome. Panerelay works only in tabs you explicitly authorize.

## How it works

```text
Any AI Agent → agent-browser CLI / MCP → Panerelay Bridge
                                              ↕ Native Messaging
Local Agents ← Chrome side panel ← Panerelay Extension ↔ Authorized tabs
```

- **agent-browser keeps browser automation semantics** such as snapshots, locators, input, waits, tabs, and screenshots.
- **The local Bridge handles routing and policy** between agent-browser, local Agent runtimes, and the Extension.
- **The Extension owns user authorization and visibility.** It does not store model credentials or start native Agent processes.

## Quickstart

Requirements: Chrome on macOS, Linux, or Windows; Node.js 20+; and a compatible agent-browser.

1. Download and extract the Extension archive from [Panerelay Releases](https://github.com/F-loat/panerelay/releases). Open `chrome://extensions`, enable Developer mode, and load the extracted directory.
2. Install the local integration and make Panerelay the user-level default agent-browser Provider:

   ```bash
   npx --yes @panerelay/setup --global-provider
   ```

3. Open Panerelay from the Chrome toolbar and authorize the current web tab or all supported web tabs.
4. Verify that any Agent can reach the authorized browser through agent-browser:

   ```bash
   agent-browser --provider panerelay tab list
   ```

5. To work from Chrome, open the side panel and select an installed local Agent. Panerelay automatically discovers supported local Agents; each Agent CLI must already be installed and signed in.

`--global-provider` lets later agent-browser commands omit `--provider panerelay`. Use `--project-provider` instead when the default should apply only to the current project. Provider selection changes routing only—it never grants Chrome permission or authorizes a tab.

## What Panerelay provides

- agent-browser workflows in authorized tabs: page interaction, screenshots, navigation, tabs and popups, diagnostics, network inspection, and request mocking.
- Side-panel conversations with supported local Agents, including history, approvals, interruption, activity, and tab-linked workspaces.
- User-scoped Native Messaging setup on macOS, Linux, and Windows.
- Local-first routing: no Panerelay cloud service is required.

See each release's notes for available side-panel Agents and the [compatibility records](docs/compatibility) for exact agent-browser coverage.

## Manage the installation

Running without an action installs or updates the local integration:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

Set Panerelay as the user-level or current-project agent-browser default Provider:

```bash
npx --yes @panerelay/setup --global-provider
npx --yes @panerelay/setup --project-provider
```

agent-browser reads the user default from `~/.agent-browser/config.json` and the project override from `./agent-browser.json`. Change the `provider` field to another configured Provider, or remove it to use agent-browser's built-in default. Panerelay remains installed and can still be selected with `--provider panerelay`.

Official builds use Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`. A self-built Extension can register its own 32-character ID:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

The ID must contain 32 lowercase letters from `a` through `p`.

## Safety and operating boundaries

- Chrome site permission, tab authorization, and the exclusive automation lease are separate. Focus never grants authorization; mutating actions require the current lease.
- Reusing login state means operating inside an authorized existing tab. Panerelay does not export or log cookies, credentials, prompts, screenshots, page content, or request bodies by default.
- Panerelay cannot own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's Chrome process.
- `webNavigation` is used only to recognize Chrome-reported related tabs so they can share conversation context. It does not read browsing history or grant site access.
- The Extension, protocol, Bridge, Provider, and setup CLI form one lockstep compatibility unit.

## Development and release checks

Workspace development requires Node.js `20.19` or newer and pnpm:

```bash
pnpm install
pnpm run check
```

Run `pnpm run dev`, then load `apps/extension/dist` as an unpacked Extension. For local Provider testing:

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
