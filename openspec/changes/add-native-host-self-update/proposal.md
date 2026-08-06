## Why

The Store-managed Extension can advance while the user-scoped Native Host remains older, but the current registration handshake neither exposes the Host version nor repairs that drift. Panerelay should keep the usable local connection available, compare versions once after each Extension background start, and update its managed Host safely without turning maintenance failure into a connection failure.

## What Changes

- **BREAKING**: replace the current version-blind registration acknowledgement with a version-aware handshake that carries the Extension semantic release version, Chromium build metadata, the running Native Host semantic release version, and a bounded one-shot update-check trigger; pre-change Hosts are not supported by this handshake.
- Embed the Panerelay release version in the Native Host bundle and let the Host compare it with the authenticated Extension's semantic `version_name` during registration.
- Complete normal browser registration before version maintenance. Existing Agent, integration, and authorized automation capabilities remain available while an older Host attempts its update and after a failed attempt.
- Trigger at most one automatic comparison/update attempt per Extension background lifetime. When the Host is older, run one bounded, exact-version `@panerelay/setup` update for Panerelay-managed Host artifacts, then exit only after success so Chrome or Edge reconnects to the new Host.
- Refuse automatic downgrade when the Host is newer, serialize concurrent Chrome and Edge update attempts, and treat an unavailable exact npm package as a quiet best-effort failure that neither crashes nor disconnects the Host.
- Stage and verify Host replacement so a failed update preserves a launchable prior installation rather than leaving a partially written executable.
- Display the Extension semantic release beside the Settings title independently of Native Host connectivity, and keep any update/reconnect presentation secondary to normal connected operation and browser authorization.
- Keep stable/beta release validation lightweight: validate artifact identity, while runtime package absence is handled safely by the Host rather than becoming a publication-time registry gate.

### Non-goals

- Supporting registration or automatic migration from Native Hosts released before this change.
- Installing, updating, downgrading, or removing agent-browser, Browser Use, Playwright CLI, Agent Skills, or Agent runtimes as part of Host self-update.
- Adding a resident updater, hosted Panerelay update service, arbitrary package selection, automatic downgrade, or rollback UI.
- Changing site permission, tab authorization, control leases, automation semantics, browser-process ownership, or unsupported browser capabilities.
- Expanding the verified automation compatibility groups: agent-browser remains pinned at 0.33.0, Browser Use at 0.13.7 with Browser Harness 0.1.8, and Playwright CLI at 0.1.17.

## Capabilities

### New Capabilities

- `native-host-version-management`: Defines non-blocking Host/Extension version comparison, bounded exact-version self-update, update serialization, quiet package-unavailable handling, and restart/reconnect behavior.

### Modified Capabilities

- `sidepanel-appearance`: Displays the Extension semantic release beside the Settings title and presents Native Host update state without changing authorization semantics.
- `stable-distribution`: Keeps Extension, Host, setup, and inventory release identities aligned without adding a publication-time npm-availability gate.

## Impact

- Shared protocol registration and Host-to-Extension status messages in `@panerelay/protocol`.
- Extension background startup/update-check state, Side Panel settings presentation, localization, and component tests.
- Bridge build metadata, normal Native Host registration, post-registration package-runner invocation, cross-process update locking, graceful success-only restart, and tests.
- Setup's managed-file installation path, which must support staged verified replacement on macOS, Linux, and Windows while preserving custom Extension identity and optional integration state.
- A new durable RFC for Host release negotiation and self-update, with corresponding RFC-0001 and RFC-0005 references, Windows Native Messaging compatibility evidence, stable/beta release checks, and operational documentation.
- No new automation-engine dependency or compatibility claim; existing Chrome/Edge browser-ownership limitations remain unchanged.
