## Why

GitHub issue #30 reports that concurrent agent-browser sessions can lose a newly created tab's virtual CDP session when a target-list request returns an older inventory. The Bridge currently removes every target absent from each list response, even when the target was created after that request began.

## What Changes

- Reconcile target-list responses against the target inventory at the time each request began, so an older response cannot evict a newer target or its sessions.
- Keep a target created during a pending refresh visible in that refresh's result.
- Add a deterministic concurrent-participant regression test and record the version-specific compatibility result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-session-lifecycle`: Target discovery remains consistent when a participant creates a target while another participant refreshes the inventory.

## Impact

The Bridge's target reconciliation and tests change. No protocol, Extension permission, or browser-process ownership behavior changes. The affected compatibility group is agent-browser tab creation, listing, and flattened page-session routing; the pinned verified baseline remains agent-browser 0.33.0. The reported environment uses agent-browser 0.38.1, which requires separate live verification before being marked verified.

## Non-goals

- Broadening authorized target discovery or retaining a target after a later authoritative list or destruction event confirms its removal.
- Adding browser contexts, process ownership, or changes to agent-browser itself.
