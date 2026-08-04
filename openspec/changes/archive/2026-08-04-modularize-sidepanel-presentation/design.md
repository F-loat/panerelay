## Context

See [proposal.md](proposal.md) for motivation. The Side Panel already uses React, Tailwind CSS 4 through the Extension Vite plugin, semantic class names, CSS custom properties for dark/light themes, and a small number of utility-class layouts. `app.tsx` nevertheless owns nearly every visible component, while `styles.css` owns the complete cascade and the main component test owns all presentation scenarios.

The controller, reducer, and client modules already provide the state and action boundary. The archived `reduce-runtime-orchestrator-duplication` design deliberately kept activation generations, optimistic sends, interruption ordering, and effects in the controller; this change must not distribute that ownership into presentation components. RFC-0001 remains authoritative for the Side Panel/Bridge boundary and browser authorization. RFC-0003 and RFC-0004 remain authoritative for visible activity, observation/control state, and release behavior.

## Goals / Non-Goals

**Goals:**

- Give the header, setup/access surface, settings, conversation timeline, and composer explicit internal module owners.
- Keep `SidepanelApp` as a small composition root with the existing controller and popover/scroll refs.
- Preserve one deterministic stylesheet entry and cascade while giving theme/foundation, chrome/settings, conversation, and composer styles separate owners.
- Extend the existing Tailwind integration for one-off layout and shared low-level primitives without obscuring semantic state selectors.
- Keep feature tests readable and independently selectable.

**Non-Goals:**

- Do not split the controller into feature Hooks or duplicate controller state in components.
- Do not introduce CSS Modules, CSS-in-JS, a component framework, or a new dependency.
- Do not replace every semantic CSS selector with utility classes.
- Do not change protocol, permissions, browser ownership, control, Provider, or conversation behavior.
- Do not create or widen any Verified, Forwarded, Partial, or Unsupported compatibility claim; agent-browser 0.33.0 remains the regression baseline.

## Decisions

### Split by visible feature, not by component size

Create internal presentation modules for header/history, setup/access/settings, conversation rendering, and composer/notices. The modules receive the existing `SidepanelController`; they do not fetch, persist, or reduce state themselves. Shared presentation-only helpers such as localized copy access and clipboard fallback move to one leaf module.

`app.tsx` continues to create the controller, own the settings and timeline refs, manage the local setup-integration selection, and compose the visible regions. This keeps cross-region coordination explicit.

Alternative considered: one file per React function. Rejected because it would produce many tiny files and obscure the feature-level relationships.

Alternative considered: feature-specific controller Hooks. Rejected because controller actions share activation generations, current-state refs, interruption, and optimistic-send ordering.

### Keep one ordered stylesheet entry

`styles.css` remains the only stylesheet imported by `main.tsx`. It imports Tailwind first, then foundation/theme, chrome/settings, conversation, composer, and motion/responsive styles in the current cascade order. Feature components do not import CSS directly, so extraction cannot change order based on module traversal.

Alternative considered: CSS Modules. Rejected because the current data attributes, cross-component selectors, test assertions, and shared state styles are intentionally global inside the isolated Extension page.

### Use Tailwind selectively

Use Tailwind utilities in JSX for one-off composition layout and use Tailwind's component layer or `@apply` only for genuinely shared structural primitives. Keep authored CSS for theme variables, data/ARIA selectors, pseudo-elements, complex grids, animations, color mixing, responsive exceptions, and rich-text descendant rules.

This hybrid approach matches the existing Tailwind-enabled build and avoids replacing clear names such as `activity-card` or `scope-switch` with long stateful class expressions.

Alternative considered: full utility conversion. Rejected because it would create a much larger visual diff, make runtime state selectors harder to audit, and couple markup tests to lengthy class strings.

### Split tests by feature with shared test support

Move reusable fake client/state builders into a test-support module. Keep feature scenarios grouped as shell/header/settings, setup/access, conversation/timeline, and composer. Layout and packaged-output tests remain separate because they validate generated CSS/HTML rather than React behavior.

Alternative considered: leave one large component test. Rejected because it would preserve the same navigation and ownership problem after production components were split.

## Risks / Trade-offs

- [CSS import extraction changes cascade precedence] → Preserve source order in the single entry file and run layout, component, build-output, dark/light, and narrow-width tests.
- [Tailwind removes semantic classes referenced by tests or selectors] → Retain semantic classes when they identify state or serve as selector anchors; utilities supplement them.
- [Component extraction creates circular imports] → Keep shared helpers controller-independent where possible and make `app.tsx` the only composition root.
- [Test fixtures drift across files] → Export one typed fake client/state builder and avoid per-suite copies.
- [File count grows without reducing cognitive load] → Use feature-sized modules rather than one file per component and review final line counts/import directions.

## Migration Plan

1. Add shared presentation helpers and extract feature components without changing class names or markup.
2. Replace `app.tsx` definitions with imports and run typecheck/component tests.
3. Move CSS into ordered feature files and update CSS-reading tests to read the complete entry graph.
4. Convert bounded one-off layouts and repeated structural declarations to the existing Tailwind path.
5. Split component tests around shared support, then run Extension checks and the full workspace check.

Rollback restores the original component and stylesheet files. There is no persisted-state, protocol, package, browser, or release migration.
