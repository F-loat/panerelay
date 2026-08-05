## Context

See [proposal.md](./proposal.md) for motivation. The Side Panel keeps complete live timeline projections in a React mount-local map. A true panel close destroys that map, while the tab workspace in `chrome.storage.session` intentionally retains only provider/conversation identity. On remount the Extension requests provider resume and can display only `ConversationDetail.messages`.

The shared ACP adapter currently captures message chunks emitted during `session/load`, but its live session state retains only the active turn's assistant assembly. Qoder 1.1.2 can load a still-live session without replaying history chunks, and the current deterministic Qoder runtime always emits synthetic history, masking that behavior. OpenCode 1.18.12 does replay history in the verified runtime and must keep that history authoritative.

## Goals / Non-Goals

**Goals:**

- Make a completed live ACP text exchange available after Side Panel remount while the provider process remains alive.
- Keep provider-replayed history authoritative and normalized through the existing context-removal path.
- Bound memory use and preserve the existing no-content-logging posture.

**Non-Goals:**

- Persisting conversation content in `chrome.storage`, files, logs, diagnostics, or a new database.
- Reconstructing reasoning, tools, approvals, images, or partial assistant output; `ConversationDetail` remains message-only.
- Guaranteeing fallback history after provider, Bridge, Native Host, or browser restart.
- Changing RFC-0001/RFC-0002 browser attachment, authorization, routing, or ownership decisions.

## Decisions

### Retain a bounded transcript on each shared ACP session

`AcpSession` will retain up to 1,000 provider-neutral `ConversationMessage` records, matching the existing bounded Claude history ceiling. Text continues to use the ACP adapter's 64-KiB character bound. The adapter records the visible text prompt before adding the first-turn Panerelay context envelope and records assistant messages only when the ACP prompt reaches completion.

This keeps the fallback at the Bridge boundary that already owns provider normalization. Persisting Side Panel timelines in `chrome.storage.session` was rejected because it would store prompts, page-derived context, and replies outside the provider process. Relying only on upstream replay was rejected because the supplied Qoder 1.1.2 evidence demonstrates a successful empty replay.

### Treat non-empty provider history as authoritative

Before `session/load`, resume snapshots the known session's retained transcript. After load, a non-empty normalized capture replaces the retained transcript and is returned. An empty capture falls back to the prior retained transcript. This avoids speculative merging and duplicate messages when providers emit complete history.

If neither source has messages, resume returns an empty list. Panerelay does not infer or fabricate content from titles, previews, diagnostics, or tool events.

### Keep the shared conversation protocol unchanged

The fallback still returns the existing `ConversationDetail.messages` shape, so Native Messaging and Extension restoration need no new content-bearing field. Full timeline restoration would require a separate provider-neutral history contract and is deferred.

### Classify compatibility conservatively

Deterministic Qoder and OpenCode tests will classify the fallback as `Automated`. The attached Qoder 1.1.2 diagnostic is valid evidence that a live turn completed, but because it was captured before remount it does not by itself make end-to-end restoration `Verified`. agent-browser 0.33.0 and browser automation compatibility are unaffected.

## Risks / Trade-offs

- [A provider emits a legitimate empty history after replacing its session state] → Fallback is limited to the same conversation ID and provider process; non-empty replay replaces it on the next load.
- [The process-local transcript differs from provider-native storage] → Provider replay wins whenever present; fallback covers only the observed live messages.
- [Memory grows with long conversations] → Retain only the newest 1,000 messages and keep the existing per-message text bound.
- [Tools and reasoning remain absent after remount] → Keep this limitation explicit; restoring full timeline semantics requires a separate protocol design.

## Migration Plan

No persisted data migration is required. Ship the shared ACP adapter change with lockstep Extension/Bridge packages. Rollback removes only the in-memory fallback and returns to provider-only history loading.
