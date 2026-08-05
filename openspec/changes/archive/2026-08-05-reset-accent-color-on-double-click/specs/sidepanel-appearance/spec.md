## ADDED Requirements

### Requirement: Users can reset the Side Panel accent color

Panerelay SHALL reset the Side Panel accent to the current default color when the user double-clicks the accent color control. The reset SHALL use the existing validated local preference path and SHALL NOT change the selected System, Dark, or Light theme mode.

#### Scenario: User double-clicks a custom accent

- **GIVEN** the user has selected a custom accent color
- **WHEN** the user double-clicks the accent color control
- **THEN** the control, Side Panel accent presentation, and local preference return to the current Panerelay default color
- **AND** the current theme mode remains unchanged

#### Scenario: Reset gesture is discoverable

- **GIVEN** the Theme settings row is visible
- **WHEN** the user inspects the accent color control
- **THEN** its localized title describes the double-click reset gesture
