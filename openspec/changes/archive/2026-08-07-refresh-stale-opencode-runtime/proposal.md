## Why

Panerelay can keep a previously discovered OpenCode executable as if it were an explicit override, even after the user's normal command path contains a newer working installation. In the observed macOS failure, the Side Panel's all-provider availability query touched the persisted OpenCode 1.2.27 binary even while Codex was selected; its bounded probe triggered Gatekeeper's transient-library rejection while OpenCode 1.18.12 was already available on the setup-captured path.

## What Changes

- Distinguish an explicit `PANERELAY_OPENCODE_PATH` override from an automatically persisted OpenCode discovery result in the protected Native Host runtime configuration.
- Keep explicit overrides authoritative, but let live PATH-based discovery take precedence over an automatically cached OpenCode path during setup, self-update, and provider discovery.
- Retain the cached path and documented user-local locations as bounded fallbacks when no live PATH candidate passes the version probe.
- Treat legacy runtime records without path-origin metadata as automatically discovered so an upgrade can repair the stale selection.
- Add regression coverage for runtime migration, override preservation, fallback discovery, and a Codex-selected provider query that must not touch the stale OpenCode fallback once a live candidate succeeds.
- Record the verified macOS/Chrome and forwarded Edge compatibility behavior.

Non-goals:

- Panerelay will not remove quarantine metadata, disable Gatekeeper, allow-list unsigned libraries, modify OpenCode, or change endpoint-security software.
- Panerelay will not install, upgrade, or delete an OpenCode installation automatically.
- This change does not alter browser site permission, tab authorization, control leases, conversation ownership, or Agent approval behavior.
- The pinned agent-browser 0.33.0 Provider and its Chrome/Edge compatibility groups are unaffected; only OpenCode executable selection inside the Bridge changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `opencode-agent-provider`: OpenCode discovery distinguishes explicit overrides from stale persisted discoveries and refreshes the latter from the live reconstructed command path without starting ACP.

## Impact

- `packages/bridge`: protected runtime configuration, Native Host installation/update discovery, and OpenCode provider executable resolution.
- `packages/setup`: doctor continues to report the selected protected runtime entry; no CLI or public protocol change is required.
- `docs/compatibility/browser-platforms.md`: OpenCode path-refresh coverage for verified macOS Chrome and forwarded Edge behavior.
- No external dependency, Extension permission, Native Messaging schema, public protocol, or automation-engine change.
