## Context

See [proposal.md](./proposal.md) for the user-visible problem. RFC-0003 currently attributes a controlled document to the engine that most recently sent a control-class command, while RFC-0004 models control as a monotonic lease-wide target subset that is cleared only by debugger detach. That model cannot remove one participant's attribution when another participant keeps the same debugger attachment referenced.

The Bridge already owns authenticated participant identity, virtual page and child sessions, target-scoped serialization, and the fail-closed access classifier. The Extension owns Chrome debugger attachment and document-local favicon injection. The implementation must preserve those boundaries, opaque target identifiers, immediate revocation, and the existing `Verified`, `Forwarded`, `Partial`, and `Unsupported` compatibility vocabulary.

## Goals / Non-Goals

**Goals:**

- Make active control state participant-scoped while leaving physical debugger attachment lease-wide.
- Produce deterministic engine attribution when participants overlap, disconnect, or release their final target reference.
- Allow a still-attached target to return to observed state without weakening command classification.
- Keep favicon changes document-local across navigation and cleanup races.
- Preserve compatibility with the verified agent-browser 0.33.0, Browser Use 0.13.7 / Browser Harness 0.1.8, and Playwright CLI 0.1.17 baselines.

**Non-Goals:**

- Do not introduce exclusive target ownership, command arbitration beyond existing target queues, or participant-to-participant handoff.
- Do not infer control from focus, actor labels, command parameters, or JavaScript source.
- Do not change target discovery, authorization, Chrome permissions, or upstream automation-engine behavior.
- Do not persist claims across Bridge or Extension restart.

## Decisions

### Store ordered control claims per target and participant

The Bridge will replace the lease-wide controlled-target set with a map from opaque target ID to participant claims. Each target contains at most one claim per participant, carrying the participant's validated automation engine and a lease-local monotonically increasing sequence. A control-class command acquires or refreshes its participant's claim before the command is forwarded. Refreshing the sequence makes the latest live control command authoritative for presentation, including when an older participant acts again.

The controlled target set is derived from targets with at least one live claim. The observed set is attached targets without live claims. Command failure retains the refreshed claim, matching RFC-0004's fail-closed attempted-control behavior.

Alternative considered: keep a target-level engine value and clear it only on detach. This cannot represent overlapping participants or select a fallback engine. A stack of commands was also rejected because it can grow without bound and retains stale duplicates; one latest claim per participant is sufficient.

### Tie claim lifetime to participant target references

A participant's claim remains live while that participant retains at least one virtual page or child-session reference to the target. Removing a virtual session triggers a claim removal only after the participant's final reference to that target is gone. Releasing, expiring, or failing a participant removes all of its claims. Target disappearance and whole-lease revocation clear all claims for the affected scope.

This lifetime matches the Bridge's authenticated cleanup boundary. It does not detach a target that another participant still references. Browser Use may intentionally keep claims for pages retained by its persistent daemon; that accurately represents live Browser Use control rather than a Panerelay-inferred task boundary.

Alternative considered: clear a claim after every command or on an inactivity timer. Both would erase visible control while a live participant still owns the relevant virtual session and would introduce timing-based semantics absent from the protocol.

### Send bounded control-presentation transitions to the Extension

The shared protocol will add a strict Extension-bound message containing only the message type, protocol version, opaque target ID, and either a validated automation engine or `null`. An engine value means the latest live claim changed; `null` means no control claim remains. The message contains no participant ID, actor label, Chrome tab ID, command parameter, or page data.

The Bridge emits a transition after claim removal when the visible engine changes or the final claim disappears. Ordinary `cdp.command` messages remain the source for applying a marker at control-command time. Existing lockstep package versioning allows this additive message without supporting mixed Bridge and Extension builds.

Alternative considered: synthesize a no-op `cdp.command` to update the favicon. This would conflate presentation with browser automation, require a fake method, and risk changing page state. Sending the complete claim map was rejected as unnecessary disclosure.

### Separate favicon replacement from initial application

The Extension will handle a non-null transition by replacing the engine artwork only when the current document already contains a Panerelay controlled-favicon node. It will not create a marker from a fallback transition. An ordinary live control-class command continues to create or refresh the marker. A `null` transition removes the target from the controlled-tab presentation and restores the favicon captured for the current document, without detaching Chrome's debugger.

This distinction preserves document locality: navigation removes injected nodes, so a later participant cleanup must not recreate a marker on a document that has received no control-class command. The target may still be counted as controlled by a surviving target-lifetime claim, while the favicon remains absent until new control reaches that document.

Alternative considered: always apply the fallback engine. This would incorrectly carry an old claim across navigation. Tracking document generations through the shared protocol was rejected because Chrome/Extension-local DOM state already supplies the narrower signal and avoids exposing new identifiers.

### Keep the existing classifier and routing boundary unchanged

`Runtime.evaluate`, `Runtime.callFunctionOn`, and every supported method outside the explicit observation allowlist remain control class. Claim acquisition happens only after target authorization and routing policy checks succeed, but before Extension forwarding. Neither the Bridge nor Extension examines arbitrary parameters to distinguish Browser Use title decoration, Playwright initialization, or user-authored mutation.

Alternative considered: special-case known Browser Use or Playwright scripts. This violates the established browser-automation boundary, is brittle across versions, and weakens fail-closed behavior.

### Amend RFCs and compatibility evidence in place

RFC-0003 will define engine attribution as the latest live participant claim and document participant-local fallback. RFC-0004 will replace monotonic lease-wide control with monotonic per-participant claims whose aggregate can downgrade while attachment remains. Version-specific compatibility records will distinguish tested coexistence behavior from platform forwarding: Chrome evidence is `Verified`; Edge remains `Forwarded` unless separately executed.

## Risks / Trade-offs

- **[A persistent participant can intentionally keep a target controlled]** → Claims follow participant references and immediate whole-lease release remains visible; Panerelay will not invent an unavailable upstream task boundary.
- **[Cleanup and a new command race on one target]** → Run claim mutations through the existing target-scoped serialized lifecycle and emit only the resulting latest-engine transition.
- **[A fallback transition arrives after target detach]** → Extension handlers resolve the current target mapping and treat absent targets as idempotent no-ops; detach remains authoritative cleanup.
- **[A navigation removes the favicon before fallback]** → Replace-only fallback refuses to create a marker when the current document lacks the Panerelay node.
- **[Bridge and Extension disagree temporarily on counts]** → The Bridge summary remains authoritative for aggregate counts; Extension controlled-tab state converges through ordered command, transition, and detach messages.
- **[Claim maps retain stale entries after unusual session cleanup]** → Participant, target, and whole-lease cleanup paths all explicitly clear claims, with multi-session and child-session tests covering final-reference detection.

## Migration Plan

1. Add the strict protocol message and validators in the lockstep protocol package.
2. Introduce Bridge claim storage, derived counts, and cleanup transitions while retaining existing debugger-reference behavior.
3. Add Extension replace-only and restore-without-detach handling.
4. Update RFC-0003, RFC-0004, and the three version-specific compatibility records.
5. Run package tests, the full repository check, strict OpenSpec validation, and a real existing-Chrome coexistence scenario.

Rollback requires reverting Bridge, Extension, and protocol changes together. There is no stored-state migration; restarting the lockstep components clears the in-memory lease and claims.
