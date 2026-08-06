## 1. Cached History Index

- [x] 1.1 Expose provider-scoped, validated, recent-first conversation summaries from the bounded Extension timeline store.
- [x] 1.2 Merge cached and provider-listed summaries with provider precedence, deterministic ordering, and cached fallback on provider-list failure.
- [x] 1.3 Add timeline-store and Side Panel router tests for provider filtering, invalid records, deduplication, ordering, unsupported listing fallback, and empty-cache errors.

## 2. Conversation Workspace Group Join

- [x] 2.1 Add a revision-checked workspace operation that moves only one tab into a matching live provider/conversation group or creates a new bound group.
- [x] 2.2 Resume the selected provider conversation before joining the captured active tab, preserving both old and destination groups on provider failure or stale revision.
- [x] 2.3 Add store and service tests for active-tab-only moves, sibling preservation, deterministic existing-group reuse, no-live-group creation, provider failure, and concurrent mutation.

## 3. Side Panel Restore Workflow

- [x] 3.1 Route an explicitly selected conversation's already resumed detail through common workspace activation without issuing a duplicate resume.
- [x] 3.2 Preserve local memory/session timelines during selection, use provider messages only as the no-local fallback, and restore the joined workspace automatically after Side Panel recreation.
- [x] 3.3 Add controller and component regressions for cached Qoder history display, selection, group-join response, retained timeline restore, reopen restore, provider-list fallback, provider-resume failure, and stale activation.

## 4. Architecture, Compatibility, and Verification

- [x] 4.1 Update RFC-0001 and Qoder 1.1.2 compatibility documentation with cached history, active-tab group joining, session lifetime, and unchanged authority boundaries.
- [x] 4.2 Run focused Extension tests and typechecks, strict OpenSpec validation, formatting, frozen install, full repository checks, and `git diff --check` without overwriting unrelated worktree changes.
- [ ] 4.3 Verify in the daily Chrome profile that a cached Qoder conversation appears when provider listing is unavailable, selecting it joins the active tab to the existing conversation group, and closing/reopening the Side Panel restores it; clean up test tabs and generated diagnostics without changing browser authorization.
