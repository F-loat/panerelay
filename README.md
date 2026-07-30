# Panerelay

[简体中文](README.zh-CN.md)

Panerelay connects AI agents to explicitly authorized tabs in the Chrome browser a user already has open. External agents can use standard `agent-browser` commands, while the Extension sidepanel provides agent conversations, activity visibility, approvals, and immediate control release.

The current release target is `0.1.0`. Candidate validation never publishes packages, creates Git
tags, or uploads artifacts.

## How it works

```text
External Agent → agent-browser → Panerelay Bridge
                                      ↕ Native Messaging
Side-panel Agent ← Panerelay Extension ↔ Authorized Chrome tabs
```

The local Bridge is the routing and policy boundary. The Extension does not store model
credentials or start native agent processes, and browser access remains limited to tabs the user
authorizes.

## Requirements

- Chrome on macOS, Linux, or Windows
- Node.js 20 or newer
- agent-browser 0.33.0 or newer
- The matching Panerelay Extension and npm package version

Codex and Qoder are optional side-panel Agent providers. The selector always shows both, defaults
to an installed provider, and falls back to Codex when neither is installed.

## Quickstart

1. Extract `panerelay-extension-0.1.0.zip`, open `chrome://extensions`, enable Developer mode, and
   load the extracted directory.
2. Install the local integration and set Panerelay as the user-level default Provider:

   ```bash
   npx --yes @panerelay/setup --global-provider
   npx --yes @panerelay/setup doctor --global-provider
   ```

3. Open Panerelay from the Chrome toolbar and authorize the current web tab or all supported web
   tabs.
4. Verify the registered Provider:

   ```bash
   agent-browser --provider panerelay tab list
   ```

Omitting an action runs setup. Use `--project-provider` instead of `--global-provider` when the default
should apply only to the current project. Provider selection changes routing only; it never grants
Chrome permission or authorizes a tab.

### Custom Extension ID

Official builds use Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`. Self-built or differently
signed Extensions can pass their actual ID:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

The value must be 32 lowercase letters from `a` through `p`; `PANERELAY_EXTENSION_ID` is the
environment alternative.

### Update and uninstall

```bash
npx --yes @panerelay/setup update
npx --yes @panerelay/setup doctor --json
npx --yes @panerelay/setup uninstall --yes
```

Windows installation is current-user scoped and does not require administrator privileges.
Uninstall removes only Panerelay-managed files and registration.

## Operating boundaries

- Chrome permission, tab authorization, and the exclusive control lease are separate and
  revocable.
- Panerelay reuses the running Chrome profile. Browser-process operations such as isolated
  contexts, launch-time proxy/profile changes, and closing Chrome are unsupported and fail
  explicitly.
- Activity is sanitized, bounded, and memory-only. Page content, cookies, credentials, prompts,
  screenshots, and request bodies are not logged by default.
- agent-browser 0.33.0 is the minimum and initial verified baseline. Newer versions do not inherit
  version-specific verification without recorded evidence.
- `0.1.0` components are a lockstep compatibility unit.

See the [agent-browser compatibility matrix](docs/compatibility/agent-browser-0.33.0.md) for
command coverage and [the release checklist](docs/releasing.md) for the remaining candidate gates.

## Development

Workspace development requires Node.js 20.19 or newer and pnpm:

```bash
pnpm install
pnpm run check
```

Run `pnpm run dev`, then load `apps/extension/dist` as an unpacked Extension. For local Provider
testing:

```bash
pnpm build
node packages/setup/dist/cli.js --project-provider
agent-browser --provider panerelay tab list
```

Build or validate unpublished artifacts with:

```bash
pnpm package
pnpm run release:check
pnpm run release:pack
```

Generated candidates stay under the ignored `.artifacts/` directory. None of these commands
publishes, tags, or uploads.

Architecture and security decisions are recorded in [`docs/rfcs`](docs/rfcs).

## License

[MIT](LICENSE)
