# PaneRelay

[简体中文](README.zh-CN.md)

PaneRelay is an open browser relay for bidirectional interoperability between users, browsers, and AI agents.

The project connects external agents to a user's existing browser through a browser extension, while providing a side panel where people can chat with agents, share browser context, review activity, approve sensitive operations, and take back control.

> Status: pre-alpha. Version `0.1.0-alpha.1` is the first locally verified release candidate; npm
> packages and a GitHub prerelease have not been published yet.

## Product direction

PaneRelay is built around three interactions:

1. External agents control an authorized browser tab through standard browser tooling.
2. Users start or resume agent conversations from the browser side panel.
3. Browser context, agent activity, approvals, and control handoffs flow in both directions.

The first browser automation integration targets [agent-browser](https://github.com/vercel-labs/agent-browser). PaneRelay intends to use its provider and CDP surfaces rather than maintain a long-lived fork.

## Proposed architecture

```text
External Agent
    │ CLI / MCP
agent-browser
    │ CDP WebSocket
PaneRelay Bridge
    ↕ Native Messaging
PaneRelay Extension ↔ Authorized browser tabs
    ↕
Side Panel Chat
    │
Agent runtime adapters
```

The local bridge is the shared policy and routing boundary. It connects browser automation clients, the extension, and agent runtimes without putting model credentials or privileged host operations inside the extension.

## Workspace

```text
apps/
  extension/           Chrome extension and side panel
packages/
  protocol/            Versioned relay protocol and shared types
  bridge/              Native Messaging host and local CDP relay
  agent-browser/       agent-browser provider adapter
  setup/               Install, diagnose, uninstall, and Agent guidance
docs/
  rfcs/                Architecture and product decisions
```

The current packages implement the first path from `agent-browser` to explicitly
authorized Chrome tabs and a normalized Codex conversation adapter for the side panel.

## RFCs

Major protocol, security, and architecture decisions are developed in [`docs/rfcs`](docs/rfcs).

- [RFC-0001: Extension connection and bidirectional agent interoperability](docs/rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0002: Browser-level CDP and agent-browser compatibility](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)
- [RFC-0003: Control session lifecycle and external-agent activity](docs/rfcs/0003-control-session-lifecycle-and-activity.md)

## Alpha quickstart

The alpha is a lockstep Extension and npm-package release. After `0.1.0-alpha.1` is published,
download and extract the matching `panerelay-extension-0.1.0-alpha.1.zip`, then:

1. Open `chrome://extensions`, enable Developer mode, and load the extracted directory as an
   unpacked Extension.
2. Install the local integration and optionally make PaneRelay the global agent-browser Provider:

   ```bash
   npx --yes @panerelay/setup@0.1.0-alpha.1 setup --global-provider
   npx --yes @panerelay/setup@0.1.0-alpha.1 doctor --global-provider
   ```

3. Open PaneRelay from the Chrome toolbar. In the side panel, explicitly authorize the current
   web tab or all supported web tabs.
4. Use standard agent-browser commands:

   ```bash
   agent-browser --session panerelay-alpha --provider panerelay snapshot -i
   agent-browser --session panerelay-alpha --provider panerelay close
   ```

Installing the Native Host or Provider never authorizes a browser tab. Chrome site permission,
PaneRelay tab authorization, and the external Agent's control lease remain separate.

The setup CLI follows the device language when it resolves to Chinese or English. Override it with
`--lang zh-CN`, `--lang en`, or the `PANERELAY_LANG` environment variable. Machine-readable
`doctor --json` output is not localized.

To update within the alpha line, run the matching setup version and reload the matching unpacked
Extension:

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 update --global-provider
```

To roll back, reinstall an earlier setup version and reload its matching Extension build. Protocol
builds are lockstep in the first alpha, so do not mix Extension and package versions. To remove the
local integration:

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 uninstall --yes
```

### Alpha limitations

- macOS and Linux Native Messaging paths are supported; Windows is not implemented.
- PaneRelay reuses the running daily Chrome profile and does not provide an isolated browser
  context, proxy, executable selection, or permission sandbox.
- Chrome-wide download paths, browser close, profile-wide cookies, and other browser-process
  operations fail closed.
- agent-browser 0.33.0 is the pinned compatibility baseline.
- Only Codex is implemented in the side panel; multiple Agent adapters and control handoff remain
  future work.
- Activity is bounded and memory-only, and alpha protocol builds require matching components.

## Development

PaneRelay uses a pnpm workspace. Building the workspace requires Node.js 20.19 or newer; published
runtime packages retain a Node.js 20 compatibility floor.

```bash
pnpm install
pnpm run check
```

Run `pnpm run dev` while developing the extension. Vite and CRXJS build the manifest-declared
service worker and side panel into `apps/extension/dist`, reload Extension runtimes during
development, and copy `apps/extension/public` assets unchanged. Load `apps/extension/dist` once as
the unpacked Extension; manually reload it after changing permissions or when Chrome does not pick
up a development-server restart.

Run `pnpm package` to build only the Chrome Extension and write
`.artifacts/panerelay-extension-<version>.zip`. Use `pnpm release:pack` only when validating the
complete npm and Extension release candidate.

To try the extension-backed `agent-browser` provider:

```bash
pnpm build
node packages/setup/dist/cli.js setup --project
```

Load `apps/extension/dist` as an unpacked Chrome extension, open PaneRelay from the
toolbar, and authorize a web tab. `--project` writes the current project's
`agent-browser.json`, so normal `agent-browser` commands use PaneRelay:

```bash
agent-browser --session panerelay-spike snapshot -i
agent-browser --session panerelay-spike close
```

Without a project or global default, select the registered Provider explicitly with
`--provider panerelay`. To make PaneRelay the user-level default Provider, run:

```bash
node packages/setup/dist/cli.js setup --global-provider
node packages/setup/dist/cli.js doctor --global-provider
```

The setup package also installs the `panerelay-browser` Agent Skill. It tells compatible
agents to keep using standard `agent-browser` commands through the PaneRelay Provider and
to respect browser-side tab authorization. The Codex side panel selects PaneRelay through
its private runtime configuration automatically.

See [RFC-0002](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)
for the current compatibility and security scope. The pinned command coverage is recorded in the
[agent-browser 0.33.0 compatibility matrix](docs/compatibility/agent-browser-0.33.0.md). Use
`node packages/setup/dist/cli.js uninstall --project --yes` to remove the development integration.

Build and fully validate an unpublished local candidate with:

```bash
pnpm run release:check
pnpm run release:pack
```

`release:check` uses disposable directories. `release:pack` retains npm tarballs, the unpacked
Extension archive, `inventory.json`, and `SHA256SUMS` under the ignored `.artifacts/` directory.
Neither command publishes, tags, or uploads anything. After an explicitly authorized release,
publish the four npm packages with `pnpm publish:alpha --otp=<code>`. Each package builds through
its `prepublishOnly` hook before pnpm publishes it with the `alpha` dist-tag. See
[the release checklist](docs/releasing.md) before publication.

## License

[MIT](LICENSE)
