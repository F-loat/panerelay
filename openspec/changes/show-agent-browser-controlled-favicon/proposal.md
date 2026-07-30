## Why

Panerelay shows a global controlled-tab count and external-control details in the side panel, but a user looking across normal Chrome tabs cannot tell which individual pages agent-browser currently controls. Chrome's debugger indicator is not attached to the page identity and does not identify the controlling automation engine.

## What Changes

- Replace the favicon of each agent-browser-controlled top-level page with the agent-browser mark plus a small green control-status dot.
- Preserve the page's original favicon and restore it when the target or complete control lease is released.
- Let navigation or refresh clear the current-document indicator, reapply it on the next target-scoped Agent command, and resist a controlled SPA replacing it at runtime.
- Keep injection best-effort so visual-indicator failure never turns a successful browser command into a false failure.
- Add Chrome's `scripting` permission without widening optional host access; scripts remain limited to origins the user already granted.

Non-goals:

- No favicon change for merely authorized or discovered tabs.
- No durable controlled-tab registry after the control lease ends.
- No provider-specific protocol field or change to agent-browser automation semantics.
- No claim that browser-internal pages can receive the indicator.

## Capabilities

### New Capabilities

- `controlled-tab-favicon`: Defines the per-tab agent-browser control indicator and restoration lifecycle.

### Modified Capabilities

None.

## Impact

- Extension: controlled-favicon generator, page injection/restoration, command lifecycle handling, and the `scripting` permission.
- Tests: icon identity, injection, release, and failure-isolation coverage.
- Documentation: RFC-0002 ownership/visibility behavior and the pinned agent-browser 0.33.0 compatibility matrix.
- Architecture: RFC-0001 authorization and RFC-0002 lazy debugger attachment remain unchanged.
