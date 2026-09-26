## Context

See `proposal.md` for the reported failure. RFC-0002 owns target discovery and virtual sessions; RFC-0003 owns participant isolation and lease cleanup. The Extension exposes a new tab before it returns the create result, but list requests are asynchronous and can represent an earlier inventory.

## Goals / Non-Goals

**Goals:** Preserve targets and page sessions introduced while an older list request is pending, while allowing a later list to remove a genuinely unavailable target.

**Non-Goals:** Change Extension authorization, target exposure rules, CDP protocol identifiers, or agent-browser automation semantics.

## Decisions

### Reconcile against request-time target state

Each refresh records the target state present when its Extension request starts. On response it may remove only unchanged targets from that recorded set that are absent from the response. It retains targets introduced meanwhile and returns the reconciled inventory. A later request begins with those targets present and may remove them if the Extension now omits them. Explicit target events mark in-flight lists as stale for the affected target. Lease cleanup advances an inventory epoch so an already resolved list cannot repopulate the next lease's inventory.

This is chosen over a fixed grace period because correctness follows request ordering without adding timers or postponing genuine removal. Serializing every list with creation would also avoid this specific race, but would hold discovery behind unrelated Extension calls across all participants and does not address asynchronous target events.

### Preserve authoritative lifecycle events

An explicit destroyed event removes the target immediately. A stale list response must not reintroduce a target that was removed after the request began. The implementation checks request-time state before applying returned target metadata as well as before removal.

## Risks / Trade-offs

- A list request started before target creation may return a merged inventory that includes the newly created target even though the Extension's response omitted it. This is intentional; a subsequent list checks the current Extension inventory.
- Live Edge/Windows reproduction is unavailable in this workspace. Automated tests cover the exact interleaving; compatibility documentation distinguishes this from a verified agent-browser 0.38.1 run. The existing 0.33.0 Verified, Forwarded, Partial, and Unsupported classifications remain unchanged.

## Migration Plan

No persisted state or protocol migration is needed. The fix ships with the next lockstep Panerelay release; reverting the Bridge change restores prior reconciliation behavior.
