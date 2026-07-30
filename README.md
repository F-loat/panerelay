# PaneRelay

[简体中文](README.zh-CN.md)

PaneRelay is an open browser relay for bidirectional interoperability between users, browsers, and AI agents.

The project connects external agents to a user's existing browser through a browser extension, while providing a side panel where people can chat with agents, share browser context, review activity, approve sensitive operations, and take back control.

> Status: preparing the first stable `0.1.0` release. Candidate creation and publication are
> separate; this repository does not publish, tag, or upload as part of validation.

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

The current packages implement the first path from `agent-browser` to explicitly authorized
Chrome tabs and normalized Codex and optional Qoder conversation adapters for the side panel.

## RFCs

Major protocol, security, and architecture decisions are developed in [`docs/rfcs`](docs/rfcs).

- [RFC-0001: Extension connection and bidirectional agent interoperability](docs/rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0002: Browser-level CDP and agent-browser compatibility](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)
- [RFC-0003: Control session lifecycle and external-agent activity](docs/rfcs/0003-control-session-lifecycle-and-activity.md)

## Stable quickstart

PaneRelay `0.1.0` supports macOS, Linux, and current-user Windows Native Messaging installation.
Use Node.js 20 or newer and agent-browser 0.33.0 or newer. The `0.1.0` Extension and all four npm
packages form one lockstep compatibility unit.

1. Download and extract `panerelay-extension-0.1.0.zip`. Open `chrome://extensions`, enable
   Developer mode, and load the extracted directory. Its retained public manifest key derives the
   official Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`; no private signing key is distributed.
2. Install and diagnose the local integration:

   ```bash
   npx --yes @panerelay/setup@0.1.0 setup
   npx --yes @panerelay/setup@0.1.0 doctor
   ```

3. Open PaneRelay from the Chrome toolbar and explicitly authorize the current web tab or all
   supported web tabs.
4. Select the registered Provider explicitly:

   ```bash
   agent-browser --session panerelay-stable --provider panerelay snapshot -i
   agent-browser --session panerelay-stable --provider panerelay close
   ```

Explicit `--provider panerelay` has command-line precedence. Use `setup --project` to make
PaneRelay the current project's default, or `setup --global-provider` for the user-level default.
Provider selection only changes routing; it never grants Chrome site permission, authorizes a tab,
or acquires the exclusive control lease.

The side panel always lists both Codex and Qoder. It selects an installed provider by default, or
Codex when neither is installed. Codex remains available independently. Qoder is optional and
becomes available when a compatible `qodercli --acp` executable is discovered; selecting an
uninstalled provider shows its install, sign-in, and documentation guidance without making
`doctor` unhealthy.

### Custom Extension IDs

Official builds use the ID above. For a self-built or differently signed Extension, pass its actual
ID consistently:

```bash
npx --yes @panerelay/setup@0.1.0 setup --extension-id <32-character-id>
npx --yes @panerelay/setup@0.1.0 doctor --extension-id <32-character-id>
```

The ID must contain exactly 32 lowercase letters from `a` through `p`. Resolution order is CLI
`--extension-id`, `PANERELAY_EXTENSION_ID`, the persisted installation value, then the official
default. `update` preserves a persisted custom ID unless a CLI or environment override replaces it.
The Host accepts only the exact effective Extension origin and also checks the Extension's actual
`chrome.runtime.id` during registration.

### Update, rollback, and uninstall

```bash
npx --yes @panerelay/setup@0.1.0 update
npx --yes @panerelay/setup@0.1.0 doctor --json
npx --yes @panerelay/setup@0.1.0 uninstall --yes
```

Repeat any project or user-default flags you want setup to maintain. To roll back, install the
earlier setup package and reload its matching Extension artifact; do not mix PaneRelay component
versions. On Windows, setup uses user-owned files and the exact current-user Chrome registry key,
so administrator privileges are not required. Uninstall removes only PaneRelay-managed files and
registration.

The CLI follows Chinese or English system language. Override it with `--lang zh-CN`, `--lang en`,
or `PANERELAY_LANG`; `doctor --json` remains language-neutral.

## Compatibility and operating boundaries

### Browser ownership

PaneRelay reuses the running daily Chrome profile. It cannot honestly provide an isolated browser
context, choose the browser executable, change launch-time proxy/profile options, or close the
browser process. Profile-wide cookies, Chrome-wide download paths, top-level request containment,
and other browser-process operations fail closed. These are ownership boundaries, not setup
defects.

### Privacy and retention

Chrome permission, PaneRelay tab authorization, and the control lease are independent and
revocable. Activity is sanitized, bounded, and memory-only; PaneRelay does not retain page content,
cookies, credentials, prompts, screenshots, request bodies, or a durable audit history by default.

### Versions

agent-browser 0.33.0 is the minimum supported version and the initial version-specific verified
baseline. Newer versions satisfy the version floor but do not inherit `Verified` classifications
until their own evidence is recorded. PaneRelay `0.1.0` components remain lockstep because the
Native Messaging protocol does not yet negotiate compatibility across releases.

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
for the current compatibility and security scope. The initial verified command coverage is recorded in the
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
publish the four npm packages with `pnpm run publish -- --otp=<code>`. Each package builds through
its `prepublishOnly` hook. See
[the release checklist](docs/releasing.md) before publication.

## License

[MIT](LICENSE)
