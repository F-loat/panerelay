## Context

See `proposal.md` for motivation and the delta specs for observable behavior. The Side Panel already maps nearly all interaction colors through semantic CSS custom properties, persists its theme choice in `chrome.storage.local`, and forwards a resolved light or dark theme to the separately injected page-comment runtime. The remaining accent sources are the fixed values in the root theme tokens, page-comment runtime palettes, and background action badge.

This is Extension presentation work. RFC-0001 and RFC-0002 authorization, control-lease, revocation, and ownership decisions remain unchanged. The agent-browser 0.33.0 Chrome classifications remain Verified where already recorded, Edge remains Forwarded where recorded, and this change makes no new compatibility claim.

## Goals / Non-Goals

**Goals:**

- Keep the user's color control compact and colocated with the existing theme selector.
- Use one validated stored base color as the source for deterministic light and dark accent roles.
- Apply preference changes immediately to the Side Panel, active page-comment UI, and visible action badge.
- Keep derivation and validation deterministic and independently testable without adding a color library.

**Non-Goals:**

- Do not make arbitrary CSS or a full token palette user-configurable.
- Do not recolor safety statuses, third-party provider marks, packaged icons, or controlled-favicon engine identity.
- Do not move preferences into the Bridge or sync them across browser profiles.

## Decisions

### Store one canonical sRGB color and derive presentation roles

A shared Extension appearance module owns the storage key, the default green, strict `#RRGGBB` normalization, relative-luminance contrast checks, and palette derivation. It keeps a valid user color unchanged when it already has sufficient surface contrast and otherwise mixes it toward black for light surfaces or white for dark surfaces until it reaches the target. It also derives hover, translucent-soft, and readable foreground roles.

Storing the derived palette was rejected because it makes future derivation fixes a data migration and can leave light and dark roles out of sync. Accepting arbitrary CSS color syntax was rejected because Extension-internal messages eventually construct injected CSS and only a bounded canonical format is needed for a native color input.

### Style a native color input beside the existing selector

The Theme row becomes a wider trailing control group containing a 22 px circular native `input[type=color]` before the existing custom theme selector. The input retains native keyboard and platform picker behavior, stays vertically centered beside the 28 px selector, and uses the same focus treatment without matching the selector's full height.

A separate settings row or custom palette popover was rejected because the requested interaction is intentionally compact and the platform picker already provides the required arbitrary-color selection.

### Apply Side Panel roles through the existing semantic tokens

The controller adds the stored base color to its state and applies the resolved palette as inline custom properties on the document root whenever the base color or effective theme changes. Existing component styles continue consuming `--accent`, `--accent-soft`, and `--accent-contrast`; an explicit hover role is added only where the injected runtime requires it. Theme selection remains an independent state value.

### Forward a bounded appearance object to the injected runtime

The existing Extension-internal page-comment start request carries the resolved accent roles, and a new appearance-only request updates an active comment document after the color, explicit theme, or resolved system theme changes. The background forwards only to the currently bound authorized comment tab. The injected runtime validates the bounded color values before using them, updates existing highlight and marker tokens, and refreshes an open editor without recreating comments or selection state.

Restarting page-comment mode on each appearance change was rejected because it conflates presentation with lifecycle and could disturb one-shot versus continuous selection. Moving appearance into the shared public protocol was rejected because no Bridge or Agent consumes it.

### Let the background observe the stored accent for the action badge

The background service worker reads the normalized preference during startup and listens for changes to the one local-storage key. Badge background and text colors update independently of the controlled-tab count. Packaged icons and controlled favicons retain their existing colors.

## Risks / Trade-offs

- **Extreme colors can lose their exact chosen lightness after contrast correction** → Preserve the selected hue where practical, expose the original base color in the picker, and test both very light and very dark inputs.
- **Appearance messages interpolate values into injected CSS** → Canonicalize the source color and validate every forwarded role against a strict bounded color format in the content runtime.
- **An active editor or marker could retain stale colors** → Keep updateable appearance hooks for highlighters, marker custom properties, touch guidance, and the open editor, with a component/runtime test covering live changes.
- **Asynchronous local storage can briefly show the default accent** → Apply the default safely during bootstrap and restore the preference before normal initialized content becomes interactive; no authority or content state depends on appearance.

## Migration Plan

1. Add the shared preference and palette derivation with unit coverage.
2. Add the compact settings control, controller persistence, and root-token application.
3. Extend page-comment start/update presentation and action-badge observation with focused tests.
4. Run Extension and repository validation, then smoke-test the settings picker in narrow and wide Side Panel layouts.
5. Roll back by removing the new storage read and controls; an unused local preference is harmless and existing default CSS values remain valid.
