# Qoder 1.1.2 compatibility

- Panerelay release: current development candidate
- Integration: user-installed Qoder CLI 1.1.2
- Provider ID: `qoder`
- ACP protocol: 1
- Last observed: 2026-08-05

## Status meanings

- **Verified**: exercised against the real Qoder 1.1.2 runtime with supporting deterministic coverage.
- **Automated**: covered by deterministic Bridge or Extension tests; the dedicated real user-facing scenario remains pending.
- **Forwarded**: uses a supported Qoder or Panerelay surface, but the relevant integration has not been exercised end to end.
- **Partial**: the primary workflow is supported with a documented compatibility limitation.
- **Unsupported**: Panerelay does not expose the operation or fails it explicitly.

## Runtime boundary

Panerelay does not install, bundle, authenticate, or configure Qoder. The Bridge launches the user-owned Qoder ACP command, keeps provider-native updates inside the Bridge, and sends only bounded provider-neutral conversation events to the Extension. Qoder and its configured tools own their processes and sessions; Panerelay browser authorization and control leases remain separate.

## Provider and conversation behavior

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Provider readiness and negotiated capabilities | Verified | A real copied diagnostic from Qoder 1.1.2 reported the ready Provider with list, resume, image, interrupt, and streaming capabilities. Deterministic tests cover optional discovery and setup failures. |
| Live text, reasoning, and activity projection | Verified | The same real diagnostic captured one completed turn with reasoning, activity, assistant-message, and terminal events and no dropped diagnostic trace entries. The diagnostic contains bounded metrics rather than reasoning or activity output text. ACP thought chunks keep one stable card for a contiguous segment and start a distinct card after intervening message, tool, plan, or approval output. The active reasoning card shows a bounded five-line preview and collapses when inactive. If Qoder reuses one assistant message identifier around a tool, the Side Panel creates ordered presentation segments so final output remains below the tool. Deterministic Qoder and Side Panel tests cover these boundaries. |
| Side Panel cached history discovery | Automated | The on-demand history picker merges provider results with validated summaries retained in the current Chrome session. Exact provider/conversation matches appear once with provider metadata taking precedence; provider omissions, successful empty lists, and failed or unsupported list operations can fall back to retained Qoder summaries. Selecting a retained summary still requires Qoder resume/load to succeed before the active tab joins the conversation's existing Extension-private workspace group. |
| Provider-native history replay | Partial | Qoder 1.1.2 can accept `session/load` for a still-live conversation without emitting user or assistant history chunks. Panerelay cannot reconstruct Provider history that was never observed in the current Provider process. |
| Side Panel close/reopen message restoration | Automated | The Extension restores a bounded `chrome.storage.session` presentation snapshot before Qoder load. Qoder-returned messages do not modify an existing local timeline because observed load history can change user-message identifiers and ordering; they are used only when no local timeline exists. A dedicated real close/reopen check is pending. |
| Full timeline restoration after remount | Automated | Extension store, controller, and component tests cover ordered message, reasoning, activity, and terminal-error restoration; events emitted while the panel is closed are replayed by local sequence. Approval and usage events, images, page context, raw provider payloads, and transient working indicators are deliberately excluded. A dedicated real Qoder check is pending. |
| Provider restart fallback | Partial | The Extension session snapshot survives Native Host or provider-process recreation within the same Chrome session and remains visible even when Qoder returns no messages. It is bounded presentation state rather than complete provider history, and events not observed by the Extension cannot be reconstructed. |
| Chrome restart fallback | Unsupported | `chrome.storage.session` ends with the browser session. Panerelay does not copy retained timelines into durable Extension storage, files, logs, diagnostics, or provider metadata; later recovery depends on provider-owned history. |

Panerelay stores the user's submitted bounded text before adding its first-turn `<panerelay-context version="1">` envelope, so process-local fallback history does not expose that envelope. Provider-owned transcript storage remains controlled by Qoder.
