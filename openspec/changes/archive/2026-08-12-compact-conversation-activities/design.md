## Context

See `proposal.md` for motivation. The Side Panel currently maps every normalized `TimelineItem` directly to one top-level React element, so a run of command or tool activities becomes a tall stack. At the same time, `conversation-history-workflow`, `agent-error-details`, and the active retained-timeline work require individual activity status and bounded terminal detail to remain recoverable. RFC-0001 keeps provider-native events behind the normalized conversation boundary; this change stays entirely after that boundary.

Mearl's `compactMessages.ts` uses one mutable progress entry per turn and removes it when the final assistant message arrives. Its useful design principle is that intermediate progress should occupy a stable amount of conversation space. Panerelay cannot copy the removal behavior directly because its current product contract intentionally retains activity details and normalized diagnostics.

## Goals / Non-Goals

**Goals:**

- Bound the default vertical space used by each consecutive activity run.
- Preserve exact timeline ordering and make every individual terminal activity detail reachable.
- Keep the presentation deterministic for live events and restored session snapshots.

**Non-Goals:**

- Changing normalized protocol events, provider adapters, timeline persistence, or diagnostic records.
- Reconstructing turn semantics when a provider omits a turn identifier.
- Changing approvals, reasoning cards, error presentation, browser authorization, control leases, or automation-engine behavior.

## Decisions

### Derive render groups without mutating timeline state

The conversation component will pass the timeline through a pure presentation helper that replaces each maximal adjacent run of at least two activity items with an activity-group render item. Runs of one remain unchanged, and every non-activity item closes the current run.

The reducer, persisted snapshot, replay log, and diagnostic exporter continue to receive and retain individual `TimelineItem` values. This keeps the change independent of the active timeline-persistence work and avoids a storage migration.

Alternative considered: merge activities in the reducer. Rejected because it would weaken diagnostic fidelity, complicate event updates by activity ID, and change the retained-timeline schema.

Alternative considered: group every activity with the same turn ID even across messages or reasoning. Rejected because Panerelay deliberately preserves assistant-message segmentation around intervening activity; grouping across those boundaries would reorder the visible conversation.

### Use a compact group summary with lossless lightweight rows

The collapsed group header will show the latest activity title, a localized total count, and an aggregate status. Status priority is running, failed, declined, then completed so live work remains obvious. Separate failed and declined counts in the summary metadata ensure an earlier non-success outcome remains visible even when a later activity is running. When the group opens, the header switches from the latest title to a neutral localized activity-log label because the latest activity is now visible in the list.

Opening the group renders its activities in original order as dedicated compact rows on one shared list surface. A row uses a small status marker, one title, and one status label without its own enclosing card border or large kind icon. Terminal rows remain disclosures and reuse the existing full-title, output, and detail regions below the row; a running row stays non-expandable. Setup-failure detection remains group-level so its recovery guide stays visible without duplicating it inside the list.

Alternative considered: reuse the complete individual activity card inside the group. Rejected after visual verification because the repeated borders, large icons, status labels, and titles made the expanded group look like another stack of top-level cards and duplicated the outer summary.

Alternative considered: copy Mearl's exact transient turn-progress slot and discard successful tool rows after final output. Rejected because current Panerelay requirements make terminal activity details and normalized diagnostics user-accessible.

Alternative considered: permanently render only the final activity. Rejected because it would hide failed intermediate steps and make mixed-outcome turns misleading.

### Keep provider and browser capability claims unchanged

This is a Verified Side Panel presentation behavior covered by pure grouping and React component tests. Activity titles, outputs, details, and statuses remain Forwarded from the existing normalized protocol. No Partial or Unsupported browser capability is promoted, and pinned agent-browser 0.33.0 plus all existing compatibility groups remain unaffected.

## Risks / Trade-offs

- [Risk] A group adds one extra disclosure step before an individual terminal detail. → Mitigation: keep the latest activity and mixed-outcome counts in the collapsed summary, then make every lightweight row directly operable after the group opens.
- [Risk] Live updates can turn a single card into a group when the second adjacent activity arrives. → Mitigation: derive groups deterministically from the current ordered timeline and keep stable keys based on constituent activity IDs.
- [Risk] Compact rows can make activity kinds less visually prominent. → Mitigation: preserve the exact title and explicit status, use status-colored markers, and retain full selectable detail on demand.

## Migration Plan

No data migration is required. The new renderer applies equally to live and restored timelines. Rollback consists of rendering `state.timeline` directly again; stored snapshots and provider data remain compatible in either direction.
