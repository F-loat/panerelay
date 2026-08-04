## Context

See [proposal.md](./proposal.md) for motivation. Qoder and OpenCode use the shared ACP adapter described by RFC-0001's provider-neutral conversation boundary. ACP `session/prompt` accepts user-message content and completes only when the Agent turn reaches a stop reason; unlike Codex, it has no standard system/developer-instruction request field and does not return an immediate turn-start acknowledgement.

The current adapter uses one 30-second helper for short control RPCs and `session/prompt`, and prepends provider-neutral guidance to the first text block. Qoder 1.1.2 and OpenCode 1.18.12 advertise embedded context, but the retained real-runtime evidence proves capability negotiation rather than behavioral equivalence for instruction-following through an embedded resource. Changing that transport in this fix would create avoidable compatibility risk.

## Goals / Non-Goals

**Goals:**

- Preserve the effective first-turn guidance, page orientation, user text, image order, and provider-owned configuration used by current Qoder and OpenCode conversations.
- Make new Panerelay-authored context exactly identifiable and remove known prior context only from normalized Side Panel history.
- Separate short control-plane request bounds from the naturally long-lived ACP prompt lifecycle.
- Preserve user interruption, permission cancellation, runtime-exit recovery, and exactly-once terminal events.

**Non-Goals:**

- Do not claim that ACP embedded-resource instructions are compatible until a retained real Qoder and OpenCode probe validates their behavior.
- Do not erase or rewrite provider-native transcript files; Panerelay controls only the normalized history it returns to the Extension.
- Do not add a new default prompt watchdog, browser tool, MCP server, browser participant, permission, or control lease.

## Decisions

### Keep the existing text prompt semantics and add a versioned envelope

New ACP sessions will wrap only the Panerelay-authored first-turn prefix in the exact fixed markers `<panerelay-context version="1">` and `</panerelay-context>`, followed by the same blank-line boundary and unmodified user text used today. The v1 parser treats those marker strings as literal protocol-private boundaries rather than accepting arbitrary attributes, whitespace variants, nesting, or XML-like equivalents. Image blocks remain in their existing order after the text block. The envelope is bounded with the existing context and prompt limits and is not a public protocol field.

This retains compatibility with Qoder and OpenCode versions that support baseline ACP text without assuming embedded-resource instruction semantics. The alternative of moving guidance to `ContentBlock::Resource` was rejected for this change because current compatibility evidence does not prove equivalent model behavior. A provider-specific `_meta` field was also rejected because ACP reserves it for extensions without defining shared instruction semantics.

### Normalize complete loaded history, not streaming chunks

History capture will continue assembling ACP `user_message_chunk` and `agent_message_chunk` updates by message identifier. After `session/load` completes, a normalization pass will inspect only the first captured user message:

- a new envelope is removed only when the literal `<panerelay-context version="1">` start marker occurs at offset zero and the first literal `</panerelay-context>` end marker exists;
- a legacy prefix is removed only when the message begins with the exact historical Panerelay guidance opening and reaches one of the exact historical terminal lines at the expected first-prompt boundary;
- a context-only legacy message is omitted, while the assistant history remains untouched;
- all other messages are preserved byte-for-byte within the existing bound.

Filtering after assembly avoids chunk-boundary errors. Restricting it to the first user message and exact scaffolding avoids broad keyword redaction and preserves user-authored text that merely mentions Panerelay, Skills, browser context, or timeouts.

### Use request timeouts only for short ACP operations

Initialization, session list/new/load/resume/close, and other control RPCs keep the existing configurable request timeout. `runPrompt` will call the active runtime request directly without the short timeout because the ACP response is the turn's terminal result, not a start acknowledgement.

No default long-turn watchdog will be introduced. A watchdog that merely rejects a local promise can detach a still-running Agent, which is the current bug. If a future bounded watchdog is required, it must first send `session/cancel`, wait for settlement, and close or restart an unresponsive runtime before reporting a terminal failure; that requires separate compatibility evidence.

### Keep terminal ownership with the active-turn identity

The session's active-turn object remains the exactly-once guard. A normal or cancelled prompt response settles the turn in `runPrompt`. Runtime exit removes the active turn and emits the provider-exit terminal event; the subsequently rejected prompt observes that it no longer owns the session and emits nothing further. Explicit interruption sends `session/cancel` and cancels pending permissions but waits for the ACP prompt response to classify the terminal state.

Provider shutdown will cancel active sessions before closing the runtime and will clear active-turn ownership so late request settlement cannot emit after shutdown. Short session-close requests remain bounded independently of prompt duration.

### Compatibility claims remain evidence-scoped

Deterministic provider tests will cover the envelope, legacy history normalization, prompts outliving the short request timeout, interruption, runtime exit, and late settlement for both Qoder and OpenCode. The checked-in real-runtime probes and compatibility documents will describe the changed assertions. Until those probes are rerun against Qoder 1.1.2 and OpenCode 1.18.12, new real-runtime behavior is Forwarded rather than upgraded to Verified solely from unit tests.

## Risks / Trade-offs

- [Provider-native history may still store the ACP text prefix] → Document that Panerelay prevents Extension exposure but cannot create a hidden ACP role that the protocol does not define; avoid claiming native transcript erasure.
- [A user pastes an exact historical Panerelay prompt as the first message] → Match the complete known opening and terminal boundary only; document the unavoidable ambiguity for already persisted legacy sessions. New versioned envelopes remove the ambiguity for future sessions.
- [An Agent never completes or exits] → Preserve user interruption and provider close; do not replace the false 30-second failure with another silent local race.
- [Shutdown races with prompt settlement] → Clear active-turn ownership once and test late resolve/reject paths after cancellation and runtime exit.
- [Context markers influence model behavior] → Keep their text minimal, retain existing ordering and content, and cover exact user suffix and images in provider tests; real probes remain the release evidence for stronger compatibility claims.

## Migration Plan

1. Ship the versioned envelope and complete-history normalization together so newly persisted prompts are never exposed by Panerelay history.
2. Apply the narrow legacy normalizer when loading existing Qoder and OpenCode sessions; no provider-native data migration is performed.
3. Remove the short timeout only from `session/prompt`; retain it for initialization and session control operations.
4. Update deterministic tests and compatibility notes, then rerun the disposable real-runtime probes before marking the new behavior Verified for a release candidate.
5. Rollback is code-only: restore the prior adapter while leaving provider-native sessions untouched. Sessions created with the versioned envelope remain valid text prompts; older clients may display the marker and context in history but can still resume the conversation.
