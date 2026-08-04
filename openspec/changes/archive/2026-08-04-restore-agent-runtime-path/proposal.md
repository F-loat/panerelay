## Why

Chrome starts a Native Messaging host with a minimal system `PATH` on macOS. Panerelay can still launch a persisted Qoder executable by absolute path, but Qoder's command tools inherit the minimal host environment and cannot find user-installed commands such as `agent-browser`, `node`, or `npx` even though they were present when Panerelay setup ran.

## What Changes

- Capture a bounded list of absolute command-search directories from the environment that installs or updates the Native Host.
- Store those directories in Panerelay's protected runtime configuration without logging them or adding them to Agent prompts.
- Reconstruct the Agent-provider process environment from the captured directories plus the current Native Host environment.
- Apply the reconstructed environment consistently to Codex, Claude Code, Qoder, and OpenCode provider processes while keeping executable ownership and Agent tool configuration unchanged.
- Add macOS/Linux and Windows path normalization, persistence, and Qoder runtime regressions.

Non-goals:

- Panerelay does not modify shell startup files, install or relocate an automation engine, execute a login shell, or expose local paths through conversation context.
- A persisted directory is not proof that an executable remains installed; ordinary command failure and targeted diagnostics remain authoritative.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qoder-agent-provider`: Qoder ACP and its command tools receive the bounded setup-captured Agent runtime search path instead of Chrome's minimal Native Host path.
- `agent-provider-preparation`: all locally launched Agent providers receive one consistent reconstructed command environment without changing discovery or preparation semantics.

## Impact

- Bridge Native Host installation and protected runtime configuration.
- Bridge AgentService and provider process launch environments.
- Qoder and cross-platform environment regression tests.
- RFC-0001 and agent-browser compatibility documentation.
- No public protocol, Extension permission, browser authorization, or external dependency changes.
