# Panerelay

English ｜ [简体中文](README.zh-CN.md)

**Let AI agents work in the Chromium browser you already use.**

Panerelay is an open-source local bridge between AI agents and your existing Chrome or Microsoft Edge session. It solves two problems while keeping browser access explicit and revocable:

1. **Let Agents work directly in Chrome or Edge.** Any Agent that can use [agent-browser](https://github.com/vercel-labs/agent-browser) through CLI or MCP can control the tabs you authorize with your current browser profile and login state—no separate browser, repeated login, or cookie export.
2. **Bring local Agents into the browser side panel.** After one Panerelay setup, the Extension discovers Codex, Claude Code, and Qoder and gives them a browser-native chat surface with conversation history, approvals, activity, and immediate control release.

Credentials stay in the browser. Panerelay works only in tabs you explicitly authorize. Agent tab selection and background automation do not switch the Chrome or Edge tab you are viewing.

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

Requirements: Chrome or Microsoft Edge on macOS, Linux, or Windows; Node.js 20+; and a compatible agent-browser.

Microsoft Edge runtime capabilities are currently classified as `Forwarded` pending complete representative acceptance. See the [browser platform compatibility record](docs/compatibility/browser-platforms.md) for the evidence boundary.

1. Install [Panerelay from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Edge. Edge may first ask you to allow extensions from other stores.
2. Install the local integration:

   ```bash
   npx --yes @panerelay/setup
   ```

3. Open Panerelay from the Chrome or Edge toolbar and authorize the current web tab or all supported web tabs.
4. If Panerelay is connected in more than one browser, use the Extension's `Default Browser` setting or select one from the CLI:

   ```bash
   npx --yes @panerelay/cli browsers
   npx --yes @panerelay/cli browser use edge
   ```

5. Verify that any Agent can reach the selected authorized browser through agent-browser:

   ```bash
   agent-browser --provider panerelay tab list
   ```

6. To work from the browser, open the side panel and select an installed local Agent. Panerelay automatically discovers Codex, Claude Code, and Qoder; each Agent CLI must already be installed and signed in. Side-panel Agents stay scoped to the browser containing that side panel, independently of the saved default.

To omit `--provider panerelay` in later commands, set Panerelay as the user-level default from Extension settings or run setup with `--global-provider`. Use `--project-provider` instead when the default should apply only to the current project. Provider selection changes routing only—it never grants browser permission or authorizes a tab.

## What Panerelay provides

- agent-browser workflows in authorized tabs: page interaction, screenshots, navigation, tabs and popups, diagnostics, network inspection, and request mocking.
- Side-panel conversations with supported local Agents, including history, approvals, interruption, activity, and tab-linked workspaces.
- User-scoped Native Messaging setup on macOS, Linux, and Windows.
- Local-first routing: no Panerelay cloud service is required.

See the [browser platform compatibility record](docs/compatibility/browser-platforms.md), [Claude Code compatibility record](docs/compatibility/claude-code.md), and the other [compatibility records](docs/compatibility) for exact runtime coverage.

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

Browser selection is a separate setting. Panerelay uses an explicit `PANERELAY_BROWSER_ID` or `PANERELAY_BROWSER` selector first, then the saved browser default, then the only ready browser. Multiple ready browsers without a choice fail closed instead of using focus or registration order:

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use <registration-id|chrome|edge>
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
- The Extension, protocol, Bridge, Provider, setup package, browser registry, and optional administration CLI form one lockstep compatibility unit.

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
