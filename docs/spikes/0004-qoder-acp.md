# Spike 0004: Qoder CLI ACP compatibility

## Status

Conclusive for the initial Panerelay adapter baseline on 2026-07-30.

## Question

Can the locally installed Qoder CLI initialize ACP, create a session, accept a bounded prompt, and advertise the session and image capabilities needed by Panerelay without exposing provider-native payloads to the Extension?

## Probe

- Host: macOS arm64, Node.js 20.19.5
- Qoder CLI: 1.1.2, discovered from the versioned `~/.qoder/bin/qodercli/` installation
- ACP SDK: 1.3.0, resolved from the Bridge runtime dependency
- Source fixture: `packages/bridge/spikes/run-qoder-acp.mjs`
- Command:

  ```bash
  cd packages/bridge
  node spikes/run-qoder-acp.mjs /absolute/path/to/qodercli-1.1.2
  ```

The fixture starts `qodercli --acp`, rejects every permission request, initializes protocol version 1, creates a session with no MCP servers, sends one non-sensitive prompt, bounds captured output, and terminates the child process. It reports capability names and counts rather than raw ACP objects, local context, or stderr content.

## Result

Initialization succeeded and identified `qoder-cli` 1.1.2. The runtime advertised:

- session load, list, resume, fork, close, delete, and additional-directory capabilities;
- image and embedded-context prompt capabilities;
- HTTP and SSE MCP transports;
- mode and model session configuration categories.

ACP does not advertise a separate permission boolean in the initialization response. The client successfully registered the standard `session/request_permission` handler, but this read-only prompt did not trigger a permission request. Panerelay therefore must treat each permission request as runtime input, normalize only recognized options, and cancel unrepresentable options rather than infer broader permission support from initialization.

The non-sensitive transcript was:

- prompt: `Reply with exactly: PANE_RELAY_QODER_ACP_OK`
- response: `PANE_RELAY_QODER_ACP_OK`
- stop reason: `end_turn`
- usage: reported

The turn emitted bounded agent-message and thought chunks plus an `available_commands_update`. The latter is not part of Panerelay's normalized conversation model and should be ignored with a sanitized diagnostic.

## Decision

Use Qoder CLI 1.1.2 as the initial verified ACP evidence version. The production adapter will probe the executable and initialize lazily, branch on advertised capabilities, keep permission option IDs inside the Bridge, ignore unsupported update payloads, and make Qoder optional so failure cannot block Codex.

## Adapter hardening

The shared ACP adapter now treats `session/prompt` as a turn-lifetime request instead of applying the 30-second control-request timeout. Initialization and short session operations remain bounded. Deterministic Qoder tests cover a prompt completing after the configured control timeout, explicit cancellation, process exit, provider shutdown, provider reuse, and late prompt settlement with exactly one terminal event. This lifecycle behavior is `Forwarded` for Qoder 1.1.2 because the retained real-runtime probe was not rerun for this change.

Panerelay wraps its first-turn context in the exact literal envelope `<panerelay-context version="1">` / `</panerelay-context>`. On ACP session load, the Bridge assembles message chunks first, then removes only a complete v1 envelope or an exact recognized legacy Panerelay prefix from the first user message before returning Side Panel history. Similar or partial user-authored text is preserved. This prevents the injected prefix from appearing in Panerelay's Side Panel history; it does not remove data from Qoder's provider-native transcript store.

ACP tool-call notifications are incremental. A Qoder completion update may omit the original command title and kind or repeat the generic `Qoder tool` label. Panerelay coalesces updates by `toolCallId`, upgrades generic metadata when a specific value arrives, and preserves an earlier specific command title and kind through completion. Deterministic coverage verifies that `git status --short` remains visible after a generic completion update.
