## Context

See `proposal.md` for the dependency-footprint motivation. The current Claude Provider uses `@anthropic-ai/claude-agent-sdk` for queries and local transcript helpers while also requiring a separately discovered `claude` executable. The official Claude Code CLI exposes documented non-interactive `stream-json`, partial-message, session ID/resume, MCP configuration, and MCP permission-prompt flags. Provider-native records must remain inside the Bridge under RFC-0001, and browser tools retain RFC-0002's agent-browser 0.33.0 ownership boundary.

## Goals / Non-Goals

**Goals:**

- Preserve the existing provider-neutral Claude feature set using only the user-owned Claude Code CLI.
- Keep process, stream, transcript, approval, and browser cleanup deterministic and injectable in tests.
- Reject incompatible versions and malformed provider output before claiming a usable Provider.

**Non-Goals:**

- Import packages from npm, pnpm, nvm, or bun global module directories.
- Auto-install, update, authenticate, or bundle Claude Code.
- Reimplement Anthropic's model API or expose raw CLI records through the shared protocol.
- Change Extension permissions, agent-browser automation semantics, or control ownership.

## Decisions

### Spawn the discovered CLI instead of resolving a global SDK

The Bridge launches the exact executable persisted by setup with print mode, `stream-json` input/output, partial messages, verbose events, canonical cwd, settings sources, system instructions, and either a new session ID or resume ID. A small injectable process adapter owns stdin, stdout, stderr, exit, termination, and bounded line parsing.

Loading a globally installed SDK was rejected because Node does not resolve global modules portably and global roots differ across npm, pnpm, nvm, bun, and operating-system installations. A separate optional Provider package remains a fallback if the documented CLI protocol proves insufficient.

### Require Claude Code CLI 2.1.0 or newer

Setup continues to probe `claude --version` and records a normalized semantic version. Provider readiness and doctor require 2.1.0 or newer, a conservative floor for the documented stream input/output, partial-message, session resume, MCP config, and permission-prompt surfaces used by this adapter. Unknown or older versions remain installed but unavailable to Panerelay.

### Keep the CLI protocol behind one facade

`claude-cli.ts` defines bounded input/output records, launch options, transcript helpers, and an injectable `ClaudeCli` interface. `ClaudeProvider` continues to own provider-neutral normalization and lifecycle, so protocol and Extension code do not depend on CLI record shapes.

Each process must produce a terminal `result` record and exit successfully. Malformed JSON, an over-limit line, unexpected termination, or a non-zero exit fails the turn closed. Stderr is bounded and used only as actionable failure detail; raw stdout, prompts, tool input, and transcript records are not logged.

### Route approvals through the CLI stdio control protocol

The CLI is launched with `--permission-prompt-tool stdio`, the same transport mode used by the official Agent SDK when a `canUseTool` callback is supplied. `control_request` records with subtype `can_use_tool` become correlated Panerelay approvals. The Bridge writes exactly one `control_response` with the matching request ID and a one-request `allow` or `deny` result. A `control_cancel_request`, interrupt, disconnect, timeout, duplicate request ID, or stale tool-use ID denies or cancels the pending request.

This avoids a second MCP process and loopback approval endpoint. The existing participant-scoped `panerelay_browser` MCP server remains a normal CLI `--mcp-config` entry and grants no browser authority by itself; Chrome authorization remains explicit in the Extension.

### Read local history through a bounded transcript adapter

Claude Code does not expose a documented machine-readable session-list command. The Bridge therefore reads only bounded top-level transcript JSONL files beneath the user-owned Claude projects directory, validates session IDs and canonical working directories from record content, excludes subagent transcripts, and normalizes user/assistant text without retaining raw records.

This is classified **Partial** rather than **Verified** across arbitrary Claude versions because the on-disk index is not a documented stable API. Failure to read history does not prevent new turns. Resume itself uses the documented CLI session ID flag.

### Interrupt and close the scoped child deterministically

Interrupt marks the turn interrupted, denies pending approvals, closes stdin, sends the platform-appropriate graceful termination signal, and escalates to a bounded forced termination only when needed. Browser participant cleanup remains before the terminal event. Provider close repeats the same idempotent path for every live turn.

## Risks / Trade-offs

- [CLI event shapes drift despite documented flags] → Gate on the tested minimum, keep fixtures for representative records, bound unknown records, and classify newer live behavior separately until verified.
- [Transcript layout changes] → Treat history as optional/Partial, validate paths and IDs, and keep new conversations and explicit resume independent of listing.
- [The stdio control protocol is less prominently documented than CLI flags] → Gate it behind the tested CLI floor, preserve official-SDK-derived request and response fixtures, and reject unknown control subtypes.
- [Windows process termination differs from POSIX] → Put termination in the platform adapter and cover command construction and escalation with tests.
- [Images use a provider-native stream schema] → Add fixture coverage and fail unsupported image records before starting the process rather than degrading silently.

## Migration Plan

1. Add CLI process and transcript facades alongside the SDK facade.
2. Port deterministic Provider tests to CLI stream and process fixtures.
3. Replace SDK query/history calls, then remove the SDK package and release gates.
4. Update compatibility claims and verify packed manifests contain no Anthropic SDK or platform binary.
5. Roll back by reverting this follow-up commit; no stored Panerelay protocol or Extension data migration is required.
