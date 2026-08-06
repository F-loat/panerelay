## Context

See [proposal.md](./proposal.md) for motivation. RFC-0001 keeps tab workspace identity and bounded presentation timelines inside the Extension. The workspace store currently maps each live Chrome tab to one opaque group, while the timeline store keeps up to 30 provider/conversation records containing a sanitized `ConversationSummary` and visible timeline. The Side Panel history request bypasses that timeline index and forwards directly to `conversation.list`; its selection path resumes the provider and rewrites the active tab's current group rather than joining a group already bound to the selected conversation.

Qoder capability status must stay conservative:

- **Verified:** Qoder 1.1.2 can negotiate ACP list and resume/load in the observed runtime.
- **Partial:** Qoder can return no provider-native history chunks during a successful load.
- **Automated:** Extension-retained timeline restore is covered by deterministic tests; the dedicated real close/reopen scenario is still pending.
- **Unsupported:** Extension-retained history does not survive the end of the Chrome session and cannot make an unresumable provider conversation usable.

## Goals / Non-Goals

**Goals:**

- Reuse the existing validated timeline records as a provider-scoped history index without adding another content store.
- Keep provider history authoritative when available and make local history a graceful session-scoped fallback.
- Change history selection from group payload replacement to revision-checked active-tab migration into the selected conversation's live group.
- Reuse the existing activation path so selected and reopened conversations restore the same retained timeline semantics.

**Non-Goals:**

- Persisting an independent conversation catalog or any content beyond the existing timeline bounds.
- Resuming a conversation when the provider does not advertise resume/load or when resume fails.
- Mapping Extension-private workspace groups to Chrome's visual tab-group API.
- Consolidating pre-existing duplicate groups that happen to reference the same provider conversation.

## Decisions

### Derive cached history from validated timeline records

Add a provider-scoped list operation to the Extension timeline store. It will parse records through the existing validation path, return cloned sanitized summaries, use each record's store update timestamp as the fallback summary's recent-activity timestamp, and sort newest first.

The Side Panel request router will load retained summaries and attempt provider listing. It will merge by the exact provider/conversation pair with provider metadata winning, then sort the merged list by update timestamp. When provider listing fails, a non-empty retained list is returned; when both sources are empty, the provider error is preserved so the picker can offer retry.

Alternatives considered:

- A second history key would duplicate identifiers, summaries, lifetime, validation, compaction, and cleanup rules.
- Making the Bridge retain an Extension history index would cross the existing presentation-state boundary and still would not repair unsupported provider listing.
- Marking retained entries with a new shared protocol field is unnecessary because selection behavior is identical: every entry must pass provider resume before binding.

### Join after provider resume without reserving or rewriting the old group

Add a workspace-store operation that validates the captured tab revision, finds a live record for the exact provider/conversation pair, and then changes only the captured active tab:

1. If the tab already belongs to the matching group, return its current snapshot unchanged.
2. If another live tab is bound to the conversation, copy that record's opaque group identity, payload, and current revision to the active tab.
3. If no live matching tab exists, assign a new opaque group and revision bound to the resumed conversation.

The workspace service will validate the starting revision, request provider resume, and call this join operation with the same captured tab and revision. A concurrent mutation before completion makes the join fail closed. Unlike the current reservation flow, this does not temporarily change every sibling's revision and therefore does not need a rollback that mutates the old group after provider failure.

When historical data contains more than one live group for the same provider/conversation, the store chooses the matching record with the lowest numeric tab identifier as a deterministic canonical destination for the newly joining tab. Existing groups are not merged as part of this change.

Alternatives considered:

- Reusing the existing group-wide commit changes sibling tabs in the current workspace, which violates active-tab-only history selection.
- Moving the tab before provider resume risks leaving it bound to an unavailable or deleted provider session.
- Matching groups by conversation identifier alone risks cross-provider joins when opaque identifiers collide.

### Feed the successful resume result through workspace activation

History selection will pass the already resumed `ConversationDetail` into the common workspace activation path. That path will prefer its in-document view or Extension-retained snapshot, replay pending background events, and then use the supplied provider detail only to refresh compatible summary metadata or provide messages when no local timeline exists. It will not issue a second provider resume.

This gives explicit selection and later Side Panel recreation the same timeline restoration order. Reopening needs no new action: the existing active-tab workspace lookup resolves the newly joined group and activation loads its timeline before provider resume.

Alternative considered: duplicating timeline load/replay logic in the history handler would create two restoration reducers and make stale-generation behavior easier to diverge.

### Keep shared protocol and browser authority unchanged

The cached history list and group join remain Extension-internal request behavior. Raw Chrome tab and workspace group identifiers stay out of `@panerelay/protocol` and provider requests. The only Bridge request remains the existing provider-neutral `conversation.list` or `conversation.resume` operation.

No cache record or group membership changes authorization, target exposure, debugger attachment, control state, approvals, or control leases. RFC-0001 will document the extended workspace selection behavior without changing its security invariants.

## Risks / Trade-offs

- [A retained summary is stale or the provider deleted the session] → Treat it only as a candidate; bind the tab only after provider resume succeeds.
- [Provider listing fails while cached items exist] → Show the usable cached list and retry provider listing on the next explicit refresh; do not claim the cached list is complete provider history.
- [A provider and retained summary disagree] → Prefer provider metadata while preserving the retained timeline as the current-session presentation source.
- [Concurrent tab or workspace activity races a slow resume] → Validate the same captured tab revision both before and after provider work and fail without group mutation.
- [Multiple legacy groups reference one conversation] → Join one deterministic live group without rewriting existing tabs; future group updates remain scoped to their existing group identities.
- [Timeline LRU compaction removes an older record] → The conversation disappears from cached history unless the provider lists it; do not add a less bounded catalog.

## Migration Plan

1. Add timeline listing and merged history behavior without changing the stored timeline schema.
2. Add active-tab conversation-group join and route successful history selection through common activation.
3. Update RFC-0001 and Qoder 1.1.2 compatibility evidence with the automated fallback and session-lifetime boundary.
4. Rollback removes only the new list and join paths; existing workspace and timeline records remain valid and require no cleanup or data migration.
