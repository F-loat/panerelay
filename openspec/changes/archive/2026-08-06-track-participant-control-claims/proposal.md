## Why

Panerelay currently records control as one lease-wide target set and restores a controlled favicon only when the physical debugger attachment ends. When a temporary Playwright participant controls targets that remain referenced by a persistent Browser Use participant, Playwright attribution can remain on unrelated tabs after Playwright disconnects, so the visible engine no longer describes a live controller.

## What Changes

- Track control claims per target and authenticated participant instead of only a lease-wide controlled-target bit.
- Attribute each current-document favicon to the most recently active live control claim.
- When a participant or its final target reference ends, remove its claims without detaching targets still referenced by another participant; restore the page favicon when no live claim remains, or fall back to the most recent remaining engine.
- Derive observed and controlled totals from live claims, allowing a still-attached target to return to observed after its final controlling participant leaves.
- Preserve the fail-closed command classifier: `Runtime.evaluate`, `Runtime.callFunctionOn`, and unknown methods remain control-class commands without inspecting their parameters.
- Amend RFC-0003 and RFC-0004 and add coexistence coverage for agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17.

Non-goals:

- Do not infer user intent or parse arbitrary JavaScript to distinguish initialization from mutation.
- Do not patch, fork, intercept, or rewrite Browser Use, Browser Harness, Playwright CLI, or agent-browser behavior.
- Do not widen site permission, tab authorization, target discovery, or browser-process ownership.
- Do not detach a target merely to refresh its favicon while another live participant still references it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-session-lifecycle`: Make controlled-target state and engine-attributed favicon ownership follow live participant target claims, including participant-local release and fallback while shared debugger attachments remain.

## Impact

- Shared protocol: add a bounded target-control presentation update that carries only an opaque target ID and optional validated engine identifier.
- Bridge: maintain participant-scoped control claims, derive controlled totals, and emit claim transitions during command forwarding, virtual-session cleanup, participant release, target removal, and whole-lease revocation.
- Extension: apply, replace, or restore the document-local favicon independently from physical debugger detach while keeping attachment and authorization state unchanged.
- Tests and documentation: add multi-participant engine fallback and downgrade coverage; update RFC-0003, RFC-0004, Browser Use and Playwright compatibility records. agent-browser 0.33.0 remains the verified baseline; Browser Use 0.13.7 / Browser Harness 0.1.8 and Playwright CLI 0.1.17 are the affected integration baselines. Chrome remains Verified and Edge remains Forwarded where already documented.
