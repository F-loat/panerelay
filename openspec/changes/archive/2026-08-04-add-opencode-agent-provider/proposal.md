## Why

OpenCode exposes a stable ACP subprocess with the session, streaming, image, interruption, and permission capabilities already normalized by Panerelay's Qoder adapter, but it is not discoverable or usable from the Side Panel. Supporting it as an optional Agent broadens the local-first provider choice without changing the Extension/Bridge trust boundary or adding another provider-native protocol to the Extension.

## What Changes

- Add OpenCode as an optional, capability-negotiated ACP Agent provider in the Bridge and Side Panel.
- Extract the reusable ACP subprocess, session, event, permission, and lifecycle behavior currently coupled to Qoder so Qoder and OpenCode share one fail-closed implementation while retaining product-specific executable discovery, commands, labels, and setup guidance.
- Discover and version-probe user-installed OpenCode executables across supported platforms, persist the resolved runtime through setup, and report it through setup and doctor without making it a core prerequisite.
- Preserve project working directories for listed and resumed ACP sessions, including OpenCode's directory-scoped history.
- Add provider catalog, localized setup guidance, automated contract coverage, packed-distribution assertions, and a pinned OpenCode compatibility record backed by a real runtime probe.
- Keep OpenCode-owned browser tools independent: Panerelay does not inject agent-browser, Browser Use, a Skill, or an MCP server into an OpenCode session and does not infer ownership of any automation participant OpenCode starts from its own configuration.
- Keep agent-browser 0.33.0 as the unchanged Chrome-verified regression baseline for the shared Bridge; this change affects Agent conversation, optional-runtime discovery, setup/doctor, and packed-distribution compatibility groups, not CDP command semantics or browser authorization.

Non-goals:

- Expose OpenCode model, mode, agent, slash-command, or authentication selection as new Side Panel controls.
- Connect to or control an already-running OpenCode TUI/server instance.
- Install OpenCode automatically, store its model credentials, or make it required for Native Host readiness.
- Change site permission, tab authorization, control leases, target identity, or automation-engine ownership.
- Claim compatibility with arbitrary future OpenCode releases without capability negotiation and representative evidence.

## Capabilities

### New Capabilities

- `opencode-agent-provider`: Defines OpenCode discovery, ACP-backed conversation behavior, normalized events and approvals, lifecycle cleanup, browser-ownership boundaries, and provider selection behavior.

### Modified Capabilities

- `guided-browser-readiness`: Adds targeted OpenCode setup guidance and keeps a missing or incompatible OpenCode runtime non-blocking.
- `stable-distribution`: Adds OpenCode to optional Agent discovery, packed-artifact validation, and pinned runtime compatibility evidence.

## Impact

- Bridge Agent provider registry, ACP process/session adapter, executable discovery, runtime configuration, Host installation, and provider tests.
- Setup CLI, doctor output, localized diagnostics, and packed consumer coverage on macOS, Linux, and Windows.
- Extension Side Panel provider catalog, setup guidance, localization, and provider-selection/controller tests.
- OpenSpec main/delta specs and `docs/compatibility/`; no provider-native OpenCode payload crosses `@panerelay/protocol`, and no protocol change is expected for the initial capability set.
- Runtime dependency remains `@agentclientprotocol/sdk`; OpenCode stays external and user-installed.
