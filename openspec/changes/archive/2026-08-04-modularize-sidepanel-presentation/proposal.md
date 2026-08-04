## Why

The Side Panel presentation is concentrated in one 1,900-line React module and one 2,800-line stylesheet, which makes otherwise independent header, setup, settings, conversation, and composer changes expensive to review and verify. The Extension already ships Tailwind CSS, so this is a good point to establish explicit component and style ownership without adding another dependency or changing user-visible behavior.

## What Changes

- Split the Side Panel presentation into feature-focused internal React modules while keeping `SidepanelApp` as the composition entry point.
- Split the global stylesheet into ordered feature styles with one stable entry file.
- Use Tailwind utilities and component-layer primitives for common layout, spacing, typography, visibility, and state patterns where they reduce custom CSS; retain authored CSS for complex selectors, animations, pseudo-elements, responsive behavior, and runtime-driven visual states.
- Split presentation tests along the same feature boundaries and retain focused layout/build-output checks.
- Preserve the existing controller, reducer, Chrome messaging client, localization keys, accessibility semantics, and rendered behavior.

Non-goals:

- Do not change browser authorization, control leases, target selection, Provider readiness, approvals, project context, page comments, image handling, or conversation behavior.
- Do not move browser ownership or policy into presentation components, infer authorization from focus, or expose raw Chrome identifiers.
- Do not replace the React controller with multiple action Hooks or change Extension/Bridge protocol messages.
- Do not migrate the Website or other packages to Tailwind in this change.

## Capabilities

This is a behavior-preserving internal refactor. The change opts out of delta specs because no capability requirement changes.

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- Affects `apps/extension/src/pages/sidepanel` source layout, presentation imports, styles, and tests.
- Adds no runtime dependency, package export, persisted state, migration, protocol version, browser permission, compatibility claim, or public API.
- Keeps agent-browser 0.33.0 as the pinned compatibility baseline. Side-panel Provider sessions, browser tools, normal Provider release, participant cleanup, and all other compatibility groups remain unchanged because this change does not alter their integration paths.
