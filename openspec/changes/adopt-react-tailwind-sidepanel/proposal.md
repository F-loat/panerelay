## Why

The Side Panel is currently implemented as one large imperative TypeScript module plus static HTML
and CSS, which makes stateful UI changes difficult to isolate and test. Moving this surface to a
component model before changing conversation behavior reduces regression risk and gives later
workspace work a maintainable foundation.

## What Changes

- Render the Side Panel with React 19 components while leaving the Manifest V3 background service
  worker and browser-control code as framework-free TypeScript.
- Adopt Tailwind CSS 4 for layout and component styling while retaining semantic CSS variables for
  the current visual tokens.
- Replace imperative DOM lookup and mutation with typed component props, hooks, and a small
  provider-neutral client layer.
- Add component-level tests for the existing provider, authorization, welcome, activity, composer,
  and conversation states.
- Preserve current runtime behavior, localization, accessibility labels, Chrome permissions,
  agent-provider protocol, and agent-browser 0.33.0 compatibility classifications.

Non-goals:

- No new conversation-history, new-conversation, provider-prewarm, or tab-binding behavior; those
  belong to a separate behavior change after this migration.
- No framework in the background service worker or shared protocol packages.
- No widening of browser ownership, authorization, or supported agent-browser capabilities.
- No visual redesign beyond small equivalence fixes required by component extraction.

## Capabilities

### New Capabilities

None. This is an implementation-only migration and the change opts out of delta specs.

### Modified Capabilities

None.

## Impact

- Extension Side Panel entry point, view components, state hooks, styles, and tests.
- Extension build dependencies: React 19, React DOM, Tailwind CSS 4, and Vite integration.
- Build output remains a Chrome Manifest V3 Side Panel served by the existing Vite/CRXJS pipeline.
- No protocol, Bridge, Native Messaging, permission, or agent-browser Provider contract changes.
