## Context

See `proposal.md` for motivation. The setup CLI currently creates a multiselect with no initial values, fixes the shared confirmation to `No`, and passes only checked integrations into an additive lifecycle. Once interactive setup removes unchecked Panerelay integrations and reconciles selected defaults in both directions, the existing protected Provider, adapter, and default configuration can represent the complete interactive state without another cache.

RFC-0001 remains authoritative for local setup ownership, Provider/default configuration, and browser authorization boundaries. RFC-0007 remains authoritative for Browser Use adapter lifecycle and detached-daemon limitations. The existing agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, and Playwright CLI 0.1.17 compatibility classifications are unchanged.

## Goals / Non-Goals

**Goals:**

- Reflect current configured Panerelay integrations and defaults in every interactive prompt.
- Make interactive setup reconcile optional Panerelay integration artifacts to the checked set.
- Keep configuration reads, writes, and removals bounded, user-scoped, and testable.

**Non-Goals:**

- Uninstall or modify upstream automation engines or unrelated user configuration.
- Change explicit flag invocations from their existing additive semantics.
- Add a shared protocol field, Extension setting, browser permission, participant, or control lease.
- Change or promote any `Verified`, `Forwarded`, `Partial`, or `Unsupported` compatibility claim.

## Decisions

### Use existing protected configuration as the single source of truth

Before an unflagged interactive prompt, read the agent-browser Panerelay Provider state plus the protected CLI adapter registry for Browser Use and Playwright. Structurally valid registrations become initial checks even when an executable later moved, so a submitted setup can repair them. Read the conditional agent-browser default and Browser Use mode for the shared confirmation. It initializes to `Yes` only when at least one selected default-capable integration exists and every such integration currently selects Panerelay; absent, malformed, mixed, or unprotected state resolves to safe unchecked/`No` presentation.

Do not add a setup-selection cache. Desired-state reconciliation makes registrations and defaults match the submitted prompt, so a second persisted copy would add drift and recovery ambiguity. Executable discovery is also rejected because finding a user-installed tool does not prove that its Panerelay integration is configured.

### Make reconciliation explicit and interactive-only

The CLI passes one internal desired-state flag only after the user submits the unflagged interactive flow. The lifecycle processes integrations sequentially because Browser Use and Playwright share the protected adapter registry:

- checked agent-browser registers or updates the Provider; unchecked agent-browser removes only the Panerelay plugin and conditionally clears the Panerelay default;
- checked Browser Use installs or updates its adapter; unchecked Browser Use uses the existing scoped uninstaller, removes its Panerelay mode/environment, and reports the existing detached-daemon warning when applicable;
- checked Playwright installs or updates its adapter; unchecked Playwright uses the existing scoped uninstaller.

For a checked default-capable integration, `Yes` applies the Panerelay default and `No` actively restores the non-Panerelay state: agent-browser conditionally clears only a current Panerelay default, and Browser Use selects Direct mode. Explicit flags never set the desired-state flag and never remove omitted integrations.

A separate top-level uninstall still removes the Native Host and all Panerelay integration artifacts as before.

### Pass initial values through the existing prompt seam

Add one side-effect-free current-state resolver to the setup package, extend the dependency-injected multiselect prompt model with `initialValues`, and pass them to the existing prompt library. Extend the shared confirmation helper to accept the resolved `initialValue`. Tests inject the resolver and inspect these values directly without driving a terminal.

After the final interactive answer, use the existing prompt library's timer spinner until lifecycle reconciliation settles. Keep the progress controller dependency-injected for deterministic success and failure tests, and do not show it for explicit or non-interactive setup calls.

Keep setup completion output scoped to components that setup applied. Optional Agent executable discovery remains part of the Native Host result for provider availability and doctor diagnostics, but setup does not render a separate optional-tools section.

## Risks / Trade-offs

- [An accidental uncheck now removes a Panerelay integration] → The localized prompt explicitly states the checked/unchecked semantics, initializes from the last selection, and cancellation remains side-effect free.
- [One reconciliation step can succeed before a later step fails] → Preserve existing per-integration rollback, process shared-registry mutations sequentially, and let the next run reflect the partial current state so it can be repaired explicitly.
- [A stale registration is initially checked] → Treat it only as current configuration presentation; selected setup still performs live executable and integration validation.
- [Browser Use removal can leave a detached daemon] → Reuse the existing uninstaller and surface its established detached-daemon warning without killing processes by name.

## Migration Plan

1. Deploy the current-state resolver without changing existing Provider, adapter, or default storage.
2. On every unflagged interactive run, derive initial values from valid protected configuration.
3. Reconcile the submitted selection so the same protected configuration becomes the next run's initial state.
4. Rollback restores additive prompt behavior; existing Provider, adapter, default, and upstream tool state remains readable by older versions.
