## Context

The Side Panel already holds a provider-neutral `SidepanelState` whose ordered `timeline` is the exact projection the user sees. Live events and resumed provider history can produce different normalized state, while the current UI offers no deterministic representation of that state for comparison. The action can therefore remain Extension-local and does not require a Bridge or protocol change. Existing browser ownership and privacy decisions remain governed by RFC-0001 and RFC-0002.

## Goals / Non-Goals

**Goals:**

- Produce a stable, readable JSON snapshot that can be pasted into an issue or Agent conversation and mechanically compared.
- Preserve timeline sequence and type-specific correlation data without flattening entries into prose.
- Retain a bounded, content-free trace of normalized conversation events so updates to the same message can be compared with intervening tool activity.
- Reuse one clipboard path with a browser API and user-gesture fallback, plus accessible localized feedback.
- Keep serialization pure and independently testable.
- Keep the diagnostic action out of the primary conversation header while providing a familiar per-message Markdown copy affordance where users read content.

**Non-Goals:**

- Capture transport-level ACP events or reconstruct data no longer present after history normalization.
- Redact user-visible conversation message text, commands, local paths, or error detail already represented in the current timeline; the user explicitly chooses whether to copy and share the resulting transcript. Reasoning text and activity output are excluded because they can contain hidden chain-of-thought, page snapshots, or unrelated authorized-tab details; deterministic character and line counts preserve enough comparison evidence.
- Diagnose or repair ordering and restoration in this change.

## Decisions

### Serialize the current Side Panel projection and normalized event metadata

The record will be generated from the latest state reference at click time. This captures the actual observed failure—including missing entries, duplicated IDs, streaming flags, and current order—without a second provider request that could produce a different view.

The Side Panel will retain up to 200 metadata-only normalized events for the active view. Each entry records receive sequence, time, kind, turn ID, and the relevant message, activity, or approval ID, without raw event content. A per-panel instance ID and conversation load source distinguish live creation, in-memory reuse, and provider resume after reopening.

Alternative: add a Bridge endpoint that exports raw provider history. Rejected because it would not describe the exact UI projection, would cross a package boundary, and would increase exposure of raw provider data.

### Use a versioned pretty-printed JSON envelope

The top-level envelope will identify a schema name and version, capture time, selected provider, conversation, workspace, active-turn/view state, and an indexed timeline. Type-specific entries retain only normalized fields already in memory. JSON is less convenient for casual reading than Markdown, but it preserves identifiers, nullability, booleans, and ordering for automated comparison.

Alternative: copy rendered Markdown. Rejected because it would erase activity types and correlation IDs that are central to the current defects.

### Keep the serializer pure and clipboard interaction at the presentation boundary

A pure serializer module will accept state and a capture timestamp, making output deterministic in tests. A small shared clipboard helper will use `navigator.clipboard.writeText` first and the existing hidden-textarea fallback second. The settings popover and each message card own their short-lived success/failure presentation state; conversation state is not mutated.

Alternative: add copy status to `SidepanelState`. Rejected because clipboard feedback is local UI state and should not enter conversation caching or workspace restoration.

### Put diagnostic copying in settings and content copying on message cards

The diagnostic action will use a Debug icon in the settings action area immediately before GitHub whenever the current view has a conversation or timeline content. Empty drafts omit the action instead of showing an unavailable troubleshooting control. The settings popover relies on its existing outside-click, trigger-toggle, and Escape dismissal instead of a redundant Close action. It is a troubleshooting operation rather than a primary conversation command, so settings provides the appropriate discoverability and visual priority. User and assistant message cards will independently expose a standard Copy icon at the top-right on pointer hover and keyboard focus. That action copies the message's original text verbatim because provider message text is already Markdown source; it does not synthesize role headings, timestamps, or diagnostic metadata.

Alternative: keep diagnostics in the conversation header and add one global transcript copy action. Rejected because the header became crowded and a global transcript does not satisfy the common need to reuse one response while preserving tables and code fences.

### Make privacy boundaries structural

The serializer will select known fields rather than spread entire state, provider, workspace, or extension-status objects. It includes user-visible message and error text because the requested artifact is a conversation record. Reasoning and activity output are represented only by character and line counts. Browser registration details, authorization targets, page comments, pasted image bytes, setup commands, storage values, and raw transport objects remain excluded.

## Risks / Trade-offs

- [The copied record can contain sensitive conversation text or visible command paths] → Label the action as copying a diagnostic conversation record and keep it strictly user-triggered; do not upload it automatically.
- [A restored record cannot prove which upstream events were omitted before normalization] → Include schema, panel instance, load source, selected provider, IDs, timeline indexes, and bounded normalized-event metadata so it can be compared with a live capture; raw transport tracing remains separate work.
- [Clipboard APIs vary in extension contexts] → Reuse the existing synchronous user-gesture fallback and expose failure feedback when neither path works.
- [Hover-only controls can be inaccessible] → Reveal message copy on `:focus-within` as well as hover, retain an accessible label, and keep it available on non-hover input devices.
- [The format will evolve] → Include an explicit schema identifier and integer version from the first release.

## Migration Plan

The action is additive and needs no persisted-state migration. Rollback removes the header action and serializer without affecting conversations or Provider data.
