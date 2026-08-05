## Context

The Theme row renders a native color input and calls `SidepanelController.setAccentColor` on selection. That controller method already validates, persists, applies, and forwards the resolved accent while preserving `themeSetting`.

## Decision

Handle the color input's double-click event in the settings component and pass `DEFAULT_ACCENT_COLOR` to the existing controller method. Keep the accessible name as “Accent color” and use localized title text to advertise the gesture.

Adding a separate reset controller method was rejected because reset has no distinct state transition: it is the same validated accent update with the repository's shared default constant. Adding another visible button was rejected because the requested gesture should not widen the compact Theme row.

## Verification

- Component-test a persisted custom accent followed by double-click reset.
- Assert the stored and rendered colors return to the default while theme mode remains System.
- Run Extension tests/typecheck, full workspace checks, OpenSpec validation, and `git diff --check`.
