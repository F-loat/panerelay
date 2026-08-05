## Why

The Side Panel accent picker can select and persist a custom color, but returning to Panerelay's default green requires manually choosing the exact color again. A double-click reset keeps the compact Theme row unchanged while providing a quick recovery path.

## What Changes

- Reset the accent to `DEFAULT_ACCENT_COLOR` when the color control is double-clicked.
- Persist and apply the reset through the existing accent update path without changing the selected System, Dark, or Light mode.
- Add localized hover text describing the reset gesture and a component regression for the interaction.

Non-goals:

- No additional button, palette, or settings row.
- No change to browser authorization, control leases, provider behavior, or browser automation.
- No change to the pinned browser compatibility groups.

## Impact

- Extension Side Panel settings component, localization, and component tests.
- Existing accent storage and rendering behavior are reused unchanged.
