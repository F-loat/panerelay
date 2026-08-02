# Claude Code compatibility

- Panerelay release: current development candidate
- Integration: user-installed Claude Code CLI 2.1.206 or newer
- Provider ID: `claude`
- Last verified: 2026-07-31

## Status meanings

- **Verified**: covered by deterministic Bridge, protocol, setup, and Extension tests against CLI process, stream, MCP permission, and transcript fixtures.
- **Forwarded**: uses a supported Claude Code CLI surface, but has not yet been exercised against a signed-in local runtime.
- **Partial**: the primary workflow is supported with a documented compatibility limitation.
- **Unsupported**: Panerelay rejects the operation instead of widening access or reporting false success.

No signed-in live Claude turn is claimed by this record. Add dated runtime evidence before treating Forwarded behavior as live-verified.

## Runtime boundary

Panerelay does not depend on, install, or bundle the Claude Agent SDK or a Claude platform binary. Setup discovers a user-owned `claude` executable, records its normalized version, and requires stable version 2.1.206 or newer before reporting the Provider ready. This floor includes Claude Code's deterministic MCP permission-tool startup behavior; prerelease versions remain unavailable. The user remains responsible for installing, updating, and authenticating Claude Code.

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
| Browser tools | Forwarded | Panerelay does not inject a browser MCP or Skill. Claude loads browser tools from its own user/project configuration; tools that connect through Panerelay still require explicit Chrome authorization and a current control lease. |
| One-request approval | Verified | A turn-scoped loopback MCP permission tool correlates each request by tool-use ID; `accept`, `decline`, and `cancel` return one JSON-stringified allow or deny decision. |
| Cancelled, duplicate, stale, or unknown approval control | Verified | Pending state is removed on MCP cancellation or disconnect; repeated IDs are denied and unsupported MCP requests fail closed. |
| Session-wide approval changes | Unsupported | Claude permission suggestions are never applied; `acceptForSession` and `declineForSession` fail closed. |
| Interruption | Verified | Matching active turns deny pending approvals, request interruption, terminate the child deterministically, and emit one interrupted terminal state. |
| Close and terminal cleanup | Verified | Pending approvals fail closed and the turn-scoped query and permission bridge close on normal completion, failure, interruption, or Provider shutdown. Panerelay does not infer or close browser-tool sessions owned by Claude configuration. |
| User/project/local Claude settings | Forwarded | The CLI loads these setting sources unchanged. Panerelay adds only its turn-scoped approval bridge and does not rewrite browser MCP or Skill configuration. |
| Automatic permission widening | Unsupported | The Provider uses Claude's default permission mode, disables sandbox auto-allow for the scoped process, and never turns an approval into a persistent rule. |

Provider-native CLI payloads remain inside the Bridge. Panerelay emits only bounded protocol events and does not log prompts, model output, tool inputs, or transcript records by default.
