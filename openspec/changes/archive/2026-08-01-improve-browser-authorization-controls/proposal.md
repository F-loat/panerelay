## Why

The settings authorization card currently conflates clearing the selected authorization scope with releasing an active browser-control lease. Users need predictable, reversible scope controls and an immediate release action that stops Agent control without silently changing the scope they selected.

## What Changes

- Make the selected “Current tab” or “All tabs” scope button toggle off when clicked again, clearing that authorization scope and releasing any active lease.
- Make the “Release” action release the current browser-control lease while preserving the selected authorization scope and Chrome site permission.
- Add a dedicated side-panel request for lease release instead of routing the action through `authorization.set` with `none`.
- Update the accepted authorization/control wording and deterministic Extension coverage for the separated interactions.
- Non-goals: changing Chrome permission prompts or removing granted Chrome site permissions; changing agent-browser or Browser Use automation semantics; granting control from focus; changing browser selection, tab ownership, target inventory, or participant ownership rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-session-lifecycle`: Distinguish authorization-scope toggling from lease release while retaining explicit revocation and fail-closed control ownership.

## Impact

- Affected code: Extension settings UI/controller, side-panel request types and routing, background authorization/lease handling, and component/router boundary tests.
- Architecture: RFC-0001 authorization-scope and control-lease wording is amended; RFC-0002 target, attachment, participant, and release boundaries remain unchanged.
- Compatibility: the pinned agent-browser 0.33.0 baseline’s “Control session and activity” release group is affected, along with Browser Use 0.13.7’s shared immediate-user-release path. Automation command groups are unaffected.
- Browser ownership limitations remain unchanged: only the user can select or clear a scope or release the complete lease; release does not close tabs or Chrome, switch the active tab, remove Chrome permissions, or end another browser registration’s lease.
