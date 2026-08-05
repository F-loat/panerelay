## Context

See `proposal.md` for the observed failures. The Extension background already owns tab-to-conversation workspace identity in `chrome.storage.session`, but the complete normalized timeline currently lives only in the Side Panel React document. Provider resume returns `ConversationDetail.messages`, so recreating the document loses reasoning, activity, and error items; some ACP providers may also return no history. Normalized `conversation.event` messages already pass through the Extension background, which remains alive independently of a particular Side Panel document.

RFC-0001 defines the Extension/Bridge boundary, Extension-private workspace storage, and the rule that workspace state grants no browser authority. This change extends that record with a separate session-local timeline retention class; it does not alter the shared Agent protocol or the browser ownership model. Capability claims are:

- **Verified:** Extension-private bounded snapshot validation, event journal replay, restore isolation, approval exclusion, reasoning segmentation, and component/state tests.
- **Forwarded:** provider-owned message history returned by `conversation.resume` remains provider data and is displayed only when no local timeline exists.
- **Partial:** retention covers the current Chrome session and bounded events observed by the Extension; it is not durable provider history.
- **Unsupported:** cross-restart timeline recovery, raw provider event replay, or restoration of permission authority.

## Goals / Non-Goals

**Goals:**

- Restore the same bounded semantic timeline when a Side Panel document is recreated.
- Capture normalized events that arrive while no Side Panel document is listening.
- Make storage validation, compaction, privacy filtering, and replay deterministic and testable.
- Keep reasoning cards structurally stable through mixed ACP thought/tool/message streams.

**Non-Goals:**

- Treating Extension storage as canonical provider history or syncing it across devices.
- Persisting composer images, page comments, page context, raw tool payloads, diagnostics traces, transient working indicators, or browser authorization state.
- Changing agent-browser `0.33.0`, Playwright, Browser Use, CDP routing, or provider ownership of browser sessions.

## Decisions

### Store a versioned snapshot plus a sequenced normalized event journal in the Extension background

Add an Extension-private timeline store backed by `chrome.storage.session`. Each record is keyed by the opaque provider/conversation pair and contains a sanitized timeline snapshot, the highest event sequence represented by that snapshot, and newer sanitized events. The background serializes all reads and writes, assigns a monotonically increasing per-record sequence to each host event, and broadcasts that sequence with the existing Extension-internal runtime message.

The Side Panel saves its normalized snapshot after local changes and after applying live events. A save acknowledges the highest sequence represented by the snapshot, allowing the background to discard older journal entries without racing a newer event. The store rejects an acknowledgement beyond its latest assigned sequence instead of clamping and pruning pending events. Because normalized host events identify the conversation but not its provider, journal append also fails closed when more than one provider record has that conversation identifier. On restore, the Side Panel loads the snapshot and replays only journal entries after that sequence through the same reducer used for live events.

Alternatives considered:

- Saving only from `beforeunload` is timing-dependent and cannot capture later events.
- Saving only from React state misses events while the panel document does not exist.
- Persisting the full timeline in the Bridge would remain process-local, cross the existing Extension-private boundary, and duplicate presentation semantics.
- Having the background reproduce the full UI reducer would couple localization and presentation state to the service worker; a bounded event journal keeps one reducer authoritative.

### Persist a shared semantic timeline projection, not UI or provider-native state

Move the normalized `TimelineItem` shape to an Extension shared module and define a versioned snapshot envelope there. The background validates and re-sanitizes every save and host event. It retains bounded message/reasoning/error text and normalized activity fields, excludes approvals from persisted snapshots and journals, strips streaming flags during hydration when no current delta proves them live, and omits all state that can carry images, page content, credentials, raw provider data, or actionable authority.

Records are bounded by item/event counts, per-field text limits, aggregate serialized size, and a least-recently-updated conversation limit below the `storage.session` quota. Compaction keeps newest records/items/events and never spills into `storage.local`.

Alternatives considered:

- Persisting raw `ConversationEvent` objects without validation would make future provider fields an accidental storage surface.
- Persisting diagnostics JSON would omit user-visible card content by policy and is intended for explicit user copy, not automatic recovery.
- `chrome.storage.local` would survive browser restarts and materially broaden the content lifetime.

### Restore local semantic state without mixing provider history

For a bound conversation, activation first requests the Extension timeline record. A valid snapshot is rendered immediately, then any pending journal events are reduced. Provider resume still runs when supported so current summary metadata and provider session state can refresh, but its messages do not modify a retained or in-memory timeline. Without a local timeline, current provider-resume message history remains the fallback.

The in-document conversation cache remains a fast path but uses the same shared snapshot shape. A stale generation cannot apply either a timeline load or provider resume to a newly active workspace.

Alternatives considered:

- Replacing retained messages from provider history would recreate the reported loss because provider history cannot represent interleaved semantic cards.
- Merging by provider message identifier duplicated the locally submitted user message when Qoder recreated it with a different identifier and order.
- Matching by role, text, and timestamp would remain heuristic and could collapse intentional repeated user prompts.

### Separate contiguous ACP reasoning segments and render cards directly

ACP turn state tracks a reasoning segment counter and an optional active segment identifier. Consecutive thought chunks reuse the active identifier. Message, tool, plan, or approval output closes the segment, so a later thought chunk receives a new identifier and appears after the intervening card. The Side Panel always renders reasoning items from the timeline; the transient turn feedback is used only before visible output and no longer conditionally hides the active reasoning item.

The Side Panel tracks the currently active reasoning identifier only as presentation state. Its card is automatically open with a five-line preview of the most recent trailing reasoning lines while deltas arrive, then collapses when another visible item or turn completion clears that identifier. Completed reasoning remains available through the native disclosure control.

Alternative considered: retaining one reasoning identifier for the entire turn preserves text but moves later thought text into a card before intervening tools and contributes to confusing visual changes.

### Segment reused message identifiers at visible timeline boundaries

Some ACP providers reuse one message identifier for assistant text emitted before and after tools. The normalized event remains provider-neutral, while the Side Panel gives each separated presentation segment its own optional timeline identifier. Deltas update only the latest contiguous segment. When one completion covers multiple segments, it ends their streaming state without replacing the first segment with the aggregate provider text.

Before activating a new message segment or another visible event kind, the reducer clears `streaming` from all older message cards. This keeps the progress caret unique to the latest active message while preserving all completed card text and order.

Message-copy controls remain absolutely positioned over the top-right card corner. Pointer hover is scoped to the message bubble rather than the whole message row, keyboard focus and status feedback reveal the control, and message content does not reserve space for the normally hidden control.

### Correlate explicit diagnostics with current browser tab state

The user-triggered conversation diagnostic record includes the Extension's latest observed active tab, authorization mode and tab, controlled tab list, control-session summary, and bounded content-free automation activity metadata. Tab titles and URLs are included because distinguishing the visible browser page from the Agent's controlled target is the purpose of this explicit copy action. The record remains local until the user copies it, does not perform a fresh browser read or acquire authority, and is never written into the retained timeline store.

## Risks / Trade-offs

- [The service worker can be suspended between host events] → Each event append is awaited before runtime broadcast and stored in `chrome.storage.session`; tests cover reopening from a journal without a mounted panel.
- [Frequent deltas can cause excessive writes] → Serialize writes, coalesce Side Panel snapshot saves with a short debounce, and rely on bounded journal appends for closure safety.
- [A save and host event can race] → Sequence acknowledgements prune only events at or below the snapshot's represented sequence, and acknowledgements ahead of the assigned journal are rejected without pruning.
- [Different providers can expose the same opaque conversation identifier] → Provider-less host events are journaled only when the retained record match is unique; ambiguous matches fail closed rather than cross-writing timelines.
- [Provider messages may change identifiers, timestamps, or order across resume] → Never mix them into an existing local timeline; use them only as a no-local-state fallback.
- [Session quota can be exhausted by long conversations] → Enforce per-field, per-record, record-count, and aggregate serialized bounds before each write.
- [A pending approval can outlive the panel] → Never persist approval events or actionable approval cards; only a current live event can create one.

## Migration Plan

1. Introduce the versioned store and request/response types. Existing sessions have no records and continue through provider resume.
2. Enable snapshot save, background journal append, isolated restore, and provider-only fallback together so no intermediate build treats partial provider data as authoritative.
3. Update RFC-0001 with the new Extension-private content class and authority boundary.
4. Rollback removes the new storage key; unknown snapshot versions are already ignored, and `chrome.storage.session` clears on browser-session end.
