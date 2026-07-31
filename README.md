# Panerelay

English ｜ [简体中文](README.zh-CN.md)

**Let AI agents work in the browser you already use.**

Panerelay is an open-source local bridge between AI agents and your existing Chrome, Edge, or Firefox session. It solves two problems while keeping browser access explicit and revocable:

1. **Let Agents work directly in Chrome, Edge, or an explicitly managed Firefox.** Any Agent that can use [agent-browser](https://github.com/vercel-labs/agent-browser) through CLI or MCP can control the tabs you authorize with your current browser profile and login state—no separate browser, repeated login, or cookie export.
2. **Bring local Agents into the browser side panel.** After one Panerelay setup, the Extension discovers Codex, Claude Code, and Qoder and gives them a browser-native chat surface with conversation history, approvals, activity, and immediate control release.

Credentials stay in the browser. Panerelay works only in tabs you explicitly authorize. Agent tab selection and background automation do not treat browser focus as permission.

![Panerelay](https://github.com/user-attachments/assets/8873dd53-ee16-484a-b801-66622ebe61ad)

## How it works

```text
Any AI Agent → agent-browser CLI / MCP → Panerelay Bridge
                                              ↕ Native Messaging
Local Agents ← browser side panel ← Panerelay Extension ↔ Authorized tabs
```

- **agent-browser keeps browser automation semantics** such as snapshots, locators, input, waits, tabs, and screenshots.
- **The local Bridge handles routing and policy** between agent-browser, local Agent runtimes, and the Extension.
- **The Extension owns user authorization and visibility.** It does not store model credentials or start native Agent processes.

## Quickstart

Requirements: Chrome, Edge, or Firefox on macOS, Linux, or Windows; Node.js 20+; and a compatible agent-browser. Firefox automation also requires geckodriver and an agent-browser build with WebDriver existing-session Provider support.

Firefox keeps Native Messaging, Agent conversations, projects, and page comments available during normal startup. Automation is an explicit WebDriver path: setup installs a separate Panerelay Firefox launcher when Firefox and geckodriver are found, and Panerelay exposes only authorized windows through participant-scoped virtual sessions. CDP-only features remain unsupported.

Firefox Provider support is currently a coordinated development contract: agent-browser has not yet published a semantic minimum with `browser.provider.webdriver-existing-session`. The exact source fixture and command-level status are recorded in [Firefox WebDriver development compatibility](docs/compatibility/firefox-webdriver-development.md); unpatched agent-browser 0.33.x remains valid for Chrome/Edge.

1. Install [Panerelay from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Edge, or temporarily load the Firefox package from the matching release for release-candidate testing.
2. Install the local integration:

   ```bash
   npx --yes @panerelay/setup
   ```

3. In Chrome or Edge, open Panerelay from the toolbar and authorize the current web tab or all supported web tabs. For Firefox automation, close normally started Firefox once, launch `~/.panerelay/bin/panerelay-firefox` (or `%USERPROFILE%\.panerelay\bin\panerelay-firefox.cmd` on Windows), open the sidebar, and authorize the current tab or all supported tabs. Normal Firefox startup remains available for conversations and page comments.
4. Verify that any Agent can reach the authorized browser through agent-browser:

   ```bash
   agent-browser --provider panerelay tab list
   ```

5. Open the Chrome/Edge side panel or Firefox sidebar and select an installed local Agent. Panerelay automatically discovers Codex, Claude Code, and Qoder; each Agent CLI must already be installed and signed in.

To omit `--provider panerelay` in later commands, set Panerelay as the user-level default from Extension settings or run setup with `--global-provider`. Use `--project-provider` instead when the default should apply only to the current project. Provider selection changes routing only—it never grants browser permission or authorizes a tab.

## What Panerelay provides

- agent-browser workflows in authorized tabs. Chrome/Edge support the documented CDP command groups; Firefox forwards the compatible WebDriver page interaction, navigation, snapshot, input, and screenshot groups while rejecting CDP-only operations.
- Side-panel conversations with supported local Agents, including history, approvals, interruption, activity, and tab-linked workspaces.
- User-scoped Native Messaging setup on macOS, Linux, and Windows.
- Local-first routing: no Panerelay cloud service is required.

See the [Claude Code compatibility record](docs/compatibility/claude-code.md) and the other [compatibility records](docs/compatibility) for exact runtime coverage.

## Manage the installation

Running without an action installs or updates the local integration:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

Extension settings can set or clear Panerelay as the user-level agent-browser default without uninstalling anything. The same defaults can be selected during setup:

```bash
npx --yes @panerelay/setup --global-provider
npx --yes @panerelay/setup --project-provider
```

agent-browser reads the user default from `~/.agent-browser/config.json`; the current project's `./agent-browser.json` takes precedence. To restore another default, change or remove its `provider` field. Panerelay remains installed and can always be selected with `--provider panerelay`.

Official builds use Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`. A self-built Extension can register its own 32-character ID:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

The ID must contain 32 lowercase letters from `a` through `p`.

The Firefox build uses ID `panerelay@f-loat.dev`. Override a self-built Firefox identity with `--firefox-extension-id <id>` or `PANERELAY_FIREFOX_EXTENSION_ID`.

Setup/update replaces only Panerelay-managed Firefox launcher and runtime files. Uninstall removes those files without deleting Firefox, profiles, or normal shortcuts. To roll back, run the earlier matching setup package and reload its matching Extension artifact.

## Safety and operating boundaries

- Browser site permission, tab authorization, and the exclusive automation lease are separate. Focus never grants authorization; mutating actions require the current lease.
- Reusing login state means operating inside an authorized existing tab. Panerelay does not export or log cookies, credentials, prompts, screenshots, page content, or request bodies by default.
- Panerelay cannot own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's browser process.
- Firefox automation uses a separate opt-in launcher. Panerelay owns and cleans up its geckodriver process but never closes Firefox automatically.
- `webNavigation` is used only to recognize browser-reported related tabs so they can share conversation context. It does not read browsing history or grant site access.
- The Extension, protocol, Bridge, Provider, and setup CLI form one lockstep compatibility unit.

## Development and release checks

Workspace development requires Node.js `20.19` or newer and pnpm:

```bash
pnpm install
pnpm run check
```

Run `pnpm run build`, then load `apps/extension/dist/chromium` in Chrome/Edge or `apps/extension/dist/firefox` in Firefox. For local Provider testing:

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
