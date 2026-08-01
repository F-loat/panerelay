## Context

See [proposal.md](./proposal.md) for motivation and [the control-session-lifecycle delta](./specs/control-session-lifecycle/spec.md) for observable behavior. The settings card currently sends every action through `panerelay.authorization.set`; choosing `none` both clears Extension-local scope state and releases active target discovery. The background already has a lease-wide `releaseControl` path that detaches targets and publishes a lease-scoped `cdp.detached` event to the Bridge.

RFC-0001 owns the durable distinction between eligibility and control leases, while RFC-0002 owns target attachment and complete-lease cleanup. The change must retain explicit Chrome permission acquisition, user-visible revocation, and fail-closed target eligibility.

## Goals / Non-Goals

**Goals:**

- Give scope buttons toggle semantics without adding another persisted state.
- Route the release action to complete-lease cleanup without mutating authorization state.
- Serialize authorization and release clicks through the existing pending state so their effects cannot race in the side panel.
- Keep the internal request and background behavior directly testable.

**Non-Goals:**

- Removing optional Chrome host permissions when a scope is toggled off.
- Changing Bridge, shared protocol, agent-browser 0.33.0, or Browser Use 0.13.7 command semantics.
- Introducing per-participant release, browser switching, or tab closing through this settings action.

## Decisions

### Add a dedicated Extension-internal release request

Add `panerelay.control.release` to the side-panel request union and router. The background handler invokes the existing lease-wide release primitive with a user-action reason and returns current status. The request is Extension-internal, so no new shared-protocol message is needed; the existing lease-scoped `cdp.detached` message remains the Bridge boundary.

Alternative considered: continue sending `authorization.set` with `none` and restore the old selection afterward. That would publish transient unauthorized state, rewrite persisted all-tabs selection, and make concurrent status updates ambiguous.

### Resolve toggle intent in the rendered scope controls

When a segmented scope button is already active, its click passes `none`; otherwise it passes the clicked scope. The controller keeps permission acquisition and authorization updates centralized. This makes the selected visual control the source of the toggle intent without weakening programmatic authorization checks.

Alternative considered: make every `setAuthorization` call toggle when its argument matches current state. That would give a command named “set” surprising behavior to other callers and could clear authorization during a retry or repeated status-driven action.

### Reuse one pending gate for both operations

The controller exposes a separate release method but uses `authorizationPending` for both authorization mutation and lease release. Scope and release controls are disabled together until the response completes, preventing a release response from overwriting a newer authorization response or vice versa.

### Preserve scope state below the UI boundary

Lease release clears attachments, target exposure, discovery state, and Bridge participants, then returns status without assigning `authorizationMode`, `authorizedTab`, `authorizedOriginPatterns`, or the persisted all-tabs key. Authorization changes continue to update those fields and revoke the old lease before applying the new scope.

RFC-0001 will be amended to name scope clearing and lease release as distinct user actions. RFC-0002 remains unchanged because complete-lease target cleanup and participant revocation are preserved.

## Risks / Trade-offs

- [The release button can be clicked while a scope is selected but no lease exists] → Treat release as an idempotent fail-closed request: preserve scope, acquire nothing, and return current status.
- [A user may expect toggling off to remove Chrome’s granted site permission] → Keep helper text and RFC wording clear that the control clears Panerelay’s selected scope; Chrome permission management remains owned by Chrome.
- [Scope changes may race with a newly connecting participant] → Send complete-lease release on every actual scope change, not only when a target is already attached or discovery has started.

## Migration Plan

Ship the Extension UI, request type/router, background handler, tests, RFC amendment, and compatibility-note update in one lockstep release. No stored-state migration is required. Rollback restores the previous request routing and UI click behavior; existing authorization storage remains compatible in either direction.
