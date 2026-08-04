## Why

The Side Panel already centralizes its interaction colors behind semantic CSS tokens, but users cannot choose the accent that identifies selected controls and active Panerelay UI. A compact color control beside the existing light/dark theme selector can make the Extension feel personal without adding another settings row or changing the meaning of safety and status colors.

## What Changes

- Add an accessible color picker immediately before the existing theme selector in the Side Panel settings row.
- Persist one validated custom accent color locally and restore the current green when no custom value exists.
- Derive readable light- and dark-theme accent roles from the selected color, then apply them immediately to Side Panel buttons, selection states, focus treatments, and other existing accent-token consumers.
- Forward the resolved accent presentation to page-comment UI and use it for the controlled-tab count badge so Extension-owned accent surfaces stay consistent.
- Keep danger, warning, provider branding, packaged Extension icons, and engine-specific controlled favicons independent from the user accent.

Non-goals:

- No replacement of the existing System, Dark, and Light theme choices.
- No user-defined full palette, typography, spacing, or component skinning.
- No changes to site authorization, tab control, control leases, focus behavior, or browser ownership.
- No changes to Bridge, Native Messaging, Agent provider, or browser-automation semantics.
- No new capability claim or compatibility reclassification for the pinned agent-browser 0.33.0 baseline, Chrome compatibility group, or forwarded Edge compatibility group.

## Capabilities

### New Capabilities

- `sidepanel-appearance`: Covers selecting, persisting, deriving, and applying a user accent across Extension-owned Side Panel, page-comment, and action-badge surfaces.

### Modified Capabilities

- `sidepanel-agent-context`: Require the page-comment picker and editor to follow the resolved custom accent in addition to the Side Panel light or dark palette.

## Impact

- Extension Side Panel settings, controller state, storage bootstrap, semantic theme tokens, and component tests.
- Extension-internal page-comment request data, injected page-comment presentation, and related tests.
- Background action-badge presentation and tests.
- No dependency, permission, public protocol, Bridge, setup, or compatibility-matrix changes.
