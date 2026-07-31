# Claude Code compatibility

- Panerelay release: current development candidate
- Integration: `@anthropic-ai/claude-agent-sdk` 0.3.220
- Provider ID: `claude`
- Last verified: 2026-07-31

## Status meanings

- **Verified**: covered by deterministic Bridge, protocol, setup, and Extension tests against an injectable official-SDK facade.
- **Forwarded**: passed through an official Claude Agent SDK interface, but not yet exercised against a signed-in local Claude Code runtime.
- **Partial**: the primary workflow is supported with a documented limitation.
- **Unsupported**: Panerelay rejects the operation instead of widening access or reporting false success.

No signed-in live Claude turn is claimed by this record. Add dated runtime evidence before treating Forwarded behavior as live-verified.

## Provider and conversations

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Executable and version discovery | Verified | Setup probes `claude --version`, persists its path/version, and reports absence as an optional warning. |
| Provider discovery and readiness | Verified | AgentService registers Claude independently of Codex and Qoder; the Extension exposes setup guidance when it is unavailable. |
| Working-directory-scoped recent sessions | Verified | The provider calls `listSessions` with the selected directory, includes programmatic sessions, bounds results to 30, and normalizes newest session metadata. |
| Stored history and resume | Verified | `getSessionInfo` and bounded `getSessionMessages` output become provider-neutral user/assistant history; subagent transcript records are excluded. |
| New conversation identity | Partial | Panerelay reserves the session ID before the first turn; it becomes SDK-persisted when the query starts. Empty drafts remain local to the Extension. |
| Text and reasoning streaming | Verified | Injected SDK `stream_event` deltas map to bounded `message.delta` and `reasoning.delta` events. |
| Completed assistant messages | Verified | Assistant text blocks map to bounded provider-neutral messages without exposing raw SDK records. |
| Tool activity and progress | Verified | Tool use, results, failures, and progress map to sanitized command, file-change, browser, web-search, or generic-tool activities. |
| Token usage | Verified | Input, output, cache creation, and cache read fields map to the shared usage event. |
| Live Claude model execution | Forwarded | Query creation, resume, terminal result, and error handling use the official SDK; signed-in runtime evidence is pending. |

## Input, tools, and lifecycle

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| PNG, JPEG, WebP, and GIF input | Verified | Bounded Extension image input maps to official SDK base64 image blocks; protocol and provider tests cover image-only turns. |
| Browser tools | Partial | Claude receives a scoped `panerelay_browser` MCP server when agent-browser is installed. Chrome still requires explicit user authorization. |
| One-request approval | Verified | `canUseTool` requests are correlated to conversation, turn, and tool-use ID. `accept`, `decline`, and `cancel` resolve only that request. |
| Session-wide approval changes | Unsupported | Claude permission suggestions are never applied; `acceptForSession` and `declineForSession` fail closed. |
| Interruption | Verified | Matching active turns call SDK interrupt, deny pending approvals, and emit one interrupted terminal state. |
| Close and terminal cleanup | Verified | Pending approvals fail closed and scoped browser sessions are closed on normal completion, failure, interruption, or provider shutdown. |
| User/project/local Claude settings | Forwarded | The official SDK loads these setting sources; Panerelay does not modify their contents. |
| Automatic permission widening | Unsupported | The provider uses Claude's default permission mode and never turns an approval into a persistent rule. |

Provider-native SDK payloads remain inside the Bridge. Panerelay emits only bounded protocol events and does not log prompts, model output, tool inputs, or transcript records by default.
