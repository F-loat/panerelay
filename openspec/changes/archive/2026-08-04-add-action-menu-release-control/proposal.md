## Why

The Extension's whole-lease release action currently requires opening the Side Panel and navigating to browser access settings. Adding the same action to the toolbar icon's context menu gives users a faster emergency release path without changing authorization or lease semantics.

## What Changes

- Add a localized `全部释放` / `Release all control` item to the Panerelay Extension action icon's context menu.
- Route that menu item through the existing scope-preserving whole-lease release operation used by Extension settings.
- Declare the Chrome `contextMenus` permission and cover menu registration, dispatch, localization, and packaged output with Extension tests.
- Keep the action safe and idempotent when no lease or debugger attachment is active.
- Non-goals: do not add per-tab release, clear the selected authorization scope or Chrome site permissions, change Bridge ownership, alter automation behavior, or add browser-process termination.
- Browser-ownership limitation: the action releases only the Panerelay lease and Extension debugger attachments; it does not stop user-owned Agent or browser processes.
- Keep the pinned agent-browser version at `0.33.0`; no agent-browser compatibility group changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-session-lifecycle`: Require the whole-lease release action to be available from the Extension action icon context menu with the same scope-preserving behavior as the existing settings action.

## Impact

- Affected Extension areas: `apps/extension/manifest.json`, background service-worker menu registration/click routing, locale messages, and Extension tests.
- The shared protocol, Bridge, Native Host, side-panel request API, accepted RFC decisions, agent-browser `0.33.0` behavior, and compatibility classifications remain unchanged.
