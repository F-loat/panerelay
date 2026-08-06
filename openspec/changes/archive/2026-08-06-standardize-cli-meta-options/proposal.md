## Why

Panerelay currently publishes four machine-oriented entry points as npm commands even though supported setup flows invoke them through installed launchers, package APIs, or internal scripts. The public CLI surface should contain only the two human-facing commands, with predictable help and version discovery on both.

## What Changes

- Keep `panerelay` and `panerelay-setup` as the only npm-published command names.
- Make both public commands accept `-v` and `--version`, print their owning package version as `v<semver>` without a command-name prefix, and exit successfully.
- Make both public commands accept `-h` and `--help`, print localized usage, and exit successfully.
- **BREAKING**: remove the unused `panerelay-agent-browser`, `panerelay-playwright-adapter`, `panerelay-bridge`, and `panerelay-host-install` npm `bin` declarations without compatibility shims.
- Preserve the setup-managed Native Host and Playwright launchers, adapter protocols, Bridge internal modes, and package maintenance scripts that production integrations actually use.
- Delete the dead standalone agent-browser executable source and add regression coverage for the intentional public command set.
- Non-goals: changing operational command syntax, adapter protocols, release versioning, browser attachment, authorization, tab control, participants, or control leases.

## Capabilities

### New Capabilities

- `cli-meta-options`: Defines Panerelay's intentional public CLI surface and consistent, side-effect-free help and version discovery for its user-facing commands.

### Modified Capabilities

None.

## Impact

- Public commands: `panerelay` and `panerelay-setup`.
- Removed npm command declarations: `panerelay-agent-browser`, `panerelay-playwright-adapter`, `panerelay-bridge`, and `panerelay-host-install`.
- Affected packages: `@panerelay/cli`, `@panerelay/setup`, `@panerelay/bridge`, `@panerelay/agent-browser`, and `@panerelay/playwright`.
- No protocol or dependency changes are expected. Browser ownership remains with the existing Bridge, Extension, and automation-engine boundaries; metadata queries do not select a browser or grant permission or control.
- The pinned agent-browser baseline remains 0.33.0. Its baseline, observation/control, navigation, target/session, emulation, network, and side-panel integration compatibility groups are unaffected because the production Provider path remains unchanged.
