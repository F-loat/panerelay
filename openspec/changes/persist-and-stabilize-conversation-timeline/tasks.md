## 1. Shared Timeline Model

- [x] 1.1 Define the versioned Extension-private snapshot, sequenced replay, shared timeline item, validation, sanitization, and provider-message merge helpers.
- [x] 1.2 Add focused tests for bounds, invalid records, approval exclusion, and semantic activity retention.

## 2. Background Session Retention

- [x] 2.1 Implement the serialized `chrome.storage.session` timeline store with per-conversation sequences, bounded journals, LRU/aggregate compaction, and no durable fallback.
- [x] 2.2 Append sanitized host conversation events before broadcasting and expose snapshot load/save through the Extension-internal Side Panel request router.
- [x] 2.3 Add background store and router tests for event capture without a mounted panel, save/event races, pruning, unknown records, and cleanup bounds.

## 3. Side Panel Restore

- [x] 3.1 Restore a valid snapshot and replay pending events before provider resume, preserving generation guards and falling back cleanly when no snapshot exists.
- [x] 3.2 Keep retained timelines isolated from unreliable provider history, debounce snapshot saves with sequence acknowledgements, and keep snapshots current for optimistic and live timeline changes.
- [x] 3.3 Add controller tests for close/reopen recovery, empty, reordered, and identifier-changing provider histories, provider-only fallback, background event replay, approval exclusion, stale activation, and restored diagnostics metadata.
- [x] 3.4 Add active, authorized, and controlled tab context plus content-free control activity metadata to the explicitly copied diagnostic record.

## 4. Stable Reasoning Presentation

- [x] 4.1 Segment ACP reasoning identifiers across intervening message, tool, plan, and approval output while reusing one identifier for contiguous thought deltas.
- [x] 4.2 Render reasoning timeline cards continuously and restrict transient working feedback to the period before visible output.
- [x] 4.3 Add Bridge and Side Panel tests for contiguous thought updates, thought-tool-thought ordering, and no reasoning-card hide/show flicker.
- [x] 4.4 Segment reused message identifiers around intervening visible output and prevent completion from moving final text ahead of tools.
- [x] 4.5 Auto-open the active reasoning card with a five-line preview, collapse it when inactive, and overlay copy controls without reserved content space.
- [x] 4.6 Keep the streaming indicator unique to the latest message card and make active reasoning previews follow the trailing lines.

## 5. Architecture, Compatibility, and Verification

- [x] 5.1 Update RFC-0001 and relevant compatibility notes with the session lifetime, content classification, retention bounds, unsupported recovery cases, and unchanged browser ownership guarantees.
- [x] 5.2 Run package-focused tests, formatting, the full frozen-install/check/diff validation, and remove any generated diagnostics or machine-specific artifacts.
- [ ] 5.3 Verify in the daily Chrome profile that a Qoder conversation with reasoning and tool cards survives Side Panel close/reopen and that output emitted while closed is replayed without restoring approval authority.
