## Context

RFC-0001 requires controlled state to remain visible and immediately revocable. RFC-0002 adds
browser-level multi-target control with lazy debugger attachment. Panerelay currently exposes a
global action-badge count, but not a page-local indication that the Agent has operated on the
current document and can be removed after every detach path.

Mearl's Extension implementation demonstrates a bounded approach: inject an inline data-URL
favicon, retain the original icon nodes, use a `MutationObserver` while control is active, and
restore the retained nodes on release.

## Goals / Non-Goals

**Goals:**

- Make each actively controlled page recognizable in Chrome's tab strip.
- Use the official agent-browser black-square/white-triangle mark with a green status dot.
- Let navigation and refresh restore the new document's own favicon until the Agent operates on it.
- Restore the original favicon on normal Provider cleanup, user release, target detach, and
  debugger displacement when Chrome still permits page injection.
- Keep authorization and automation success independent from indicator rendering.

**Non-Goals:**

- Do not inject into merely eligible tabs or add persistent cross-session ownership state.
- Do not use favicon state as an authorization or lease signal.
- Do not add a new Bridge or protocol message for a provider already identified as agent-browser.

## Decisions

### Use `chrome.scripting` inside existing origin grants

The Extension injects a self-contained function into the top frame after a target becomes
controlled. `scripting` can also restore the current document after Chrome has already detached the
debugger, which a CDP-only implementation cannot do. Injection is still constrained by the
Extension's existing optional origin permissions and does not make another tab eligible.

### Preserve page-owned icon nodes

The injected state captures clones of the first page-owned `link[rel~="icon"]` nodes, removes those
nodes while controlled, and inserts one Panerelay-owned link. A `MutationObserver` removes later
page-owned replacements. Release disconnects the observer, removes the owned link, and restores the
captured clones.

The state is intentionally document-local. Navigation destroys it and the background does not
reapply the indicator from tab update events. Before each valid target-scoped CDP command, the
background best-effort applies the indicator to the current top-level document. This makes the
favicon an activity marker for the document the Agent has actually touched, rather than a durable
or authoritative control-lease signal.

### Treat the indicator as best-effort

Restricted pages, revoked host permissions, closed tabs, and renderer races can reject script
injection. These failures are swallowed and never change CDP results, lease state, or eligibility.
The side panel and toolbar count remain the authoritative fallback indicators.

### Generate the icon in code

The favicon is an encoded SVG data URL so no network request or extension URL reaches the page.
The base mark matches agent-browser's favicon geometry; a white-ringed Panerelay green dot at the
bottom-right communicates active control at 16px.

## Risks / Trade-offs

- **A site has no favicon when attached** → restoration removes the controlled icon and leaves the
  page in its original no-icon state.
- **Permission is revoked before cleanup runs** → Chrome may reject restoration; the current
  document clears the injected state on its next navigation or close.
- **A SPA repeatedly rewrites favicon nodes** → one document-scoped observer removes replacements
  while control remains active.
- **The service worker restarts during an active debugger session** → Chrome debugger detachment
  ends the control lease; normal detach cleanup is attempted and no lease is revived.

## Migration Plan

1. Add the controlled-favicon module and automated tests.
2. Wire attach, target-command, target release, full release, and debugger-detach paths.
3. Add `scripting` to the Extension manifest and rebuild the unpacked candidate.
4. Reload the Extension and verify attach, refresh clearing, next-command reapplication, and
   release against the local fixture with agent-browser 0.33.0.
5. Roll back by removing the lifecycle calls and permission; toolbar and side-panel visibility
   remain available.
