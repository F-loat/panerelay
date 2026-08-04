## Context

The Native Host installer already discovers Agent executables from the user's setup environment and persists their absolute paths in a user-only runtime file. Chrome later launches the installed host with a minimal environment. Absolute executable discovery therefore succeeds, but commands spawned by an Agent runtime inherit only the minimal `PATH`. The observed Qoder 1.1.2 process had `/usr/bin:/bin:/usr/sbin:/sbin`, while `agent-browser` and `npx` were installed under a user-managed Node directory.

The fix crosses setup and Agent-provider process launch, so RFC-0001 records the durable environment boundary. It does not change browser attachment, authorization, control ownership, or automation-engine semantics.

## Goals / Non-Goals

**Goals:**

- Reproduce the ordinary setup-time command search environment for Agent provider processes launched later by Chrome.
- Keep path material in protected local configuration and process environment only.
- Normalize and bound captured entries across POSIX and Windows.
- Preserve live Native Host directories after captured entries so current system commands remain reachable.

**Non-Goals:**

- Do not source `.zshrc`, `.bashrc`, PowerShell profiles, or another interactive shell.
- Do not scan version-manager directories, guess an `agent-browser` location, or persist a tool-specific executable path.
- Do not treat captured paths as readiness or bypass Qoder's permission model.

## Decisions

### Persist bounded setup-time path entries

Native Host installation stores `agentPathEntries`, an ordered list containing the Node executable directory followed by absolute directories from the installer's `PATH`. Entries are trimmed, normalized, deduplicated, capped by count and total length, and written with the existing runtime file's user-only permissions.

Persisting the whole shell startup script was rejected because it can execute arbitrary code and varies by shell. Scanning NVM, Homebrew, pnpm, or other manager-specific directories was rejected because it guesses user configuration and becomes an unbounded compatibility surface. Persisting only the `agent-browser` executable was rejected because Qoder also needs its interpreter and ordinary user commands.

### Reconstruct only the provider child environment

At Native Host startup, Panerelay prepends validated captured entries to the current host `PATH`, preserving current entries afterward. The resulting copy is passed to every built-in Agent provider. It does not mutate shell configuration or add path text to prompts, logs, provider descriptors, or the shared protocol.

Applying the path only to Qoder was rejected because the environment loss happens at the shared Native Messaging boundary and every local Agent provider should receive the same normal command environment. Mutating global `process.env` was rejected in favor of an explicit environment passed to provider constructors.

### Treat captured state as staleable

Missing or removed directories remain harmless path entries; provider discovery and actual command execution remain live checks. Rerunning setup refreshes the list. Malformed, relative, oversized, or wrong-platform entries are ignored when reading runtime configuration.

## Risks / Trade-offs

- [A setup-time directory later contains a different executable] → This matches ordinary `PATH` semantics; only directories already trusted by the user at setup are retained, and Qoder's normal command approval still applies.
- [The captured path becomes stale] → Live command execution fails normally and setup refreshes the protected list; Panerelay does not scan or silently switch tools.
- [A runtime configuration is malformed] → Validate absolute bounded entries and retain the minimal current environment.
- [Windows environment key casing differs] → Preserve the existing case-insensitive PATH key and use the platform delimiter.

## Migration Plan

1. Add bounded path normalization and runtime-environment composition helpers.
2. Persist path entries during the next setup or update and ignore the field in older runtime files.
3. Pass the reconstructed environment explicitly to provider processes.
4. Reinstall/reload the local development Native Host for real Qoder verification.
5. Rollback ignores/removes the optional runtime field; no user shell state requires migration.
