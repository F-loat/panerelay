# Claude Code compatibility

- Panerelay release: current development candidate
- Integration: user-installed Claude Code CLI 2.1.0 or newer
- Provider ID: `claude`
- Last verified: 2026-07-31

## Status meanings

- **Verified**: covered by deterministic Bridge, protocol, setup, and Extension tests against CLI process, stream, control, and transcript fixtures.
- **Forwarded**: uses a supported Claude Code CLI surface, but has not yet been exercised against a signed-in local runtime.
- **Partial**: the primary workflow is supported with a documented compatibility limitation.
- **Unsupported**: Panerelay rejects the operation instead of widening access or reporting false success.

No signed-in live Claude turn is claimed by this record. Add dated runtime evidence before treating Forwarded behavior as live-verified.

## Runtime boundary

Panerelay does not depend on, install, or bundle the Claude Agent SDK or a Claude platform binary. Setup discovers a user-owned `claude` executable, records its normalized version, and requires 2.1.0 or newer before reporting the Provider ready. The user remains responsible for installing, updating, and authenticating Claude Code.

## Provider and conversations

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Executable and version discovery | Verified | Setup probes `claude --version`, persists its exact path/version, and reports absence or an unsupported version as an optional warning. |
| Provider discovery and readiness | Verified | AgentService registers Claude independently of Codex and Qoder; the Extension exposes install or upgrade guidance when it is unavailable. |
| Working-directory-scoped recent sessions | Partial | The Bridge scans at most a bounded set of top-level JSONL transcripts beneath the user-owned Claude projects directory. The on-disk layout is not a documented stable CLI API. |
| Stored history | Partial | Bounded user/assistant text becomes provider-neutral history; subagent, sidechain, meta, and team records are excluded. History failure does not prevent new turns. |
| New conversation identity and resume | Forwarded | Panerelay reserves a UUID and passes it through documented `--session-id` or `--resume` CLI flags. Empty drafts remain local to the Extension. |
| Text and reasoning streaming | Verified | Fragmented `stream-json` deltas map to bounded `message.delta` and `reasoning.delta` events. |
| Completed assistant messages | Verified | Assistant text blocks map to bounded provider-neutral messages without exposing raw CLI records. |
| Tool activity and progress | Verified | Tool use, results, failures, and progress map to sanitized command, file-change, browser, web-search, or generic-tool activities. |
| Token usage | Verified | Input, output, cache creation, and cache read fields map to the shared usage event. |
| Malformed or truncated CLI output | Verified | Invalid, oversized, non-terminal, or non-zero output fails the turn closed and terminates the scoped child process. |
| Live Claude model execution | Forwarded | Query creation and terminal handling use direct non-interactive CLI input/output; signed-in runtime evidence is pending. |

## Input, tools, and lifecycle

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| PNG, JPEG, WebP, and GIF input | Verified | Bounded Extension image input maps to Claude base64 image blocks over stdin; protocol and provider tests cover image-only turns. |
| Browser tools | Partial | Claude receives a scoped `panerelay_browser` MCP server through `--mcp-config` when agent-browser is installed. Chrome still requires explicit user authorization. |
| One-request approval | Verified | CLI `control_request` records are correlated by request and tool-use IDs; `accept`, `decline`, and `cancel` write one matching `control_response`. |
| Cancelled, duplicate, stale, or unknown approval control | Verified | Pending state is removed on cancellation; repeated IDs are denied and unknown control subtypes receive an error response. |
| Session-wide approval changes | Unsupported | Claude permission suggestions are never applied; `acceptForSession` and `declineForSession` fail closed. |
| Interruption | Verified | Matching active turns deny pending approvals, request interruption, terminate the child deterministically, and emit one interrupted terminal state. |
| Close and terminal cleanup | Verified | Pending approvals fail closed and scoped browser sessions close on normal completion, failure, interruption, or Provider shutdown. |
| User/project/local Claude settings | Forwarded | The CLI loads these setting sources; Panerelay does not modify their contents. |
| Automatic permission widening | Unsupported | The Provider uses Claude's default permission mode and never turns an approval into a persistent rule. |

Provider-native CLI payloads remain inside the Bridge. Panerelay emits only bounded protocol events and does not log prompts, model output, tool inputs, or transcript records by default.
