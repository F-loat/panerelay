## Context

See `proposal.md` and the `control-session-lifecycle` delta spec. RFC-0001 defines a visible immediate whole-lease release that preserves authorization, and RFC-0002 keeps that release available through browser authorization. The Side Panel currently sends `panerelay.control.release`, which the background router maps to `releaseBrowserControl()`; that operation detaches all observed and controlled targets, notifies the Host at lease scope, broadcasts status, and leaves authorization state untouched.

Chrome Manifest V3 action context-menu entries require the `contextMenus` permission, an action-scoped menu registration, and a service-worker `contextMenus.onClicked` listener. The Extension supports Chrome 116 and later, so registration must not rely on the Promise overloads added in Chrome 123.

## Goals / Non-Goals

**Goals:**

- Register one localized action-icon context-menu item during Extension installation or update.
- Route a matching click directly through the existing background whole-lease release operation.
- Keep menu registration and click selection independently testable without starting Chrome.
- Preserve current authorization, revocation, target lifecycle, and fail-closed behavior.

**Non-Goals:**

- Do not introduce another release message, protocol method, or Bridge path.
- Do not conditionally hide or disable the menu based on ephemeral service-worker state.
- Do not terminate Agent processes, browser processes, or release one target independently.

## Decisions

### Use an action-scoped Chrome context-menu entry

Declare `contextMenus` in the Extension manifest and register one stable menu identifier with context `action`. Resolve its label through Chrome's `_locales` messages so it follows the browser locale. The alternative of opening the Side Panel from the context menu would add steps and would not provide the requested immediate release.

### Register on installation and dispatch in the background service worker

Create the menu from `runtime.onInstalled`, which runs for initial installation and Extension updates while avoiding duplicate creation each time the Manifest V3 service worker wakes. Use the callback form of `contextMenus.create` for the Chrome 116 floor and consume `runtime.lastError` within that callback. Handle clicks through the service-worker event listener, as inline menu callbacks are unavailable there.

### Reuse `releaseBrowserControl()` as the single whole-lease operation

The click listener compares the stable menu identifier, then calls `releaseBrowserControl()` exactly as the Side Panel router does. This keeps authorization preservation and Host notification identical. Factoring a second detach routine or synthesizing a Side Panel runtime message would add unnecessary routing and risk semantic drift.

### Keep menu plumbing in a small background module

Place the stable identifier, menu creation properties, click predicate, and listener wiring in a focused module with injected callbacks. This permits deterministic unit coverage of registration and dispatch while the actual release state remains owned by the background entry point.

No RFC or compatibility-matrix update is required: this adds an affordance for the RFC-0001/RFC-0002 release action and does not change durable architecture or any Verified, Forwarded, Partial, or Unsupported automation capability classification.

## Risks / Trade-offs

- [Menu registration fails after an update] → Consume and report Chrome's creation error without affecting the Side Panel release path; registration is retried on the next install/update event.
- [A duplicate or unrelated context-menu click triggers release] → Use one stable identifier and ignore all non-matching menu IDs.
- [Release rejects asynchronously] → Route the error into the existing Extension error/status reporting path without leaving an unhandled service-worker rejection.
- [The menu remains visible without an active lease] → Preserve idempotent release semantics; constant visibility provides a reliable emergency affordance and avoids stale state after service-worker suspension.

## Migration Plan

The new manifest permission is installed with the next Extension update, which also registers the menu item. Rollback removes the permission, registration listener, click handler, and locale keys; Chrome removes the Extension-owned item with that build. No persisted authorization or protocol migration is needed.
