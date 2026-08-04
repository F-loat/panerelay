## Purpose

Let users personalize Panerelay's Extension-owned interaction accents while preserving readable light and dark themes and stable safety semantics.

## ADDED Requirements

### Requirement: Users can choose a Side Panel accent color

Panerelay SHALL present an accessible color control immediately before the existing System, Dark, and Light selector in the same Theme settings row. Selecting a valid color SHALL update the current Side Panel accent presentation without changing the selected light or dark theme mode.

#### Scenario: Theme row presents both appearance controls

- **GIVEN** the user opens Extension settings
- **WHEN** the Theme row renders
- **THEN** it shows a color control immediately before the existing theme selector in the same row
- **AND** both controls expose accessible names and keyboard interaction

#### Scenario: User selects a color

- **GIVEN** the Theme row is visible
- **WHEN** the user chooses a valid color
- **THEN** the Side Panel immediately updates its accent-colored controls and focus treatments
- **AND** the current System, Dark, or Light selection remains unchanged

### Requirement: Accent preference is local and resilient

Panerelay SHALL persist the selected base accent in Extension-local storage, SHALL restore it in later Side Panel sessions, and SHALL use the current Panerelay green when the stored value is absent or invalid.

#### Scenario: Stored accent is restored

- **GIVEN** the user previously selected a valid accent color
- **WHEN** the Side Panel opens again
- **THEN** it restores that base color and applies its resolved accent presentation

#### Scenario: Stored accent is not valid

- **GIVEN** the stored accent value is absent, malformed, or outside the supported color format
- **WHEN** the Side Panel initializes
- **THEN** it ignores that value and uses the current Panerelay green without failing initialization

### Requirement: Derived accents remain readable and semantic

Panerelay SHALL derive theme-appropriate accent, hover, soft, and contrasting-foreground roles from the selected base color. It SHALL maintain readable contrast against the active light or dark surfaces while leaving danger, warning, provider branding, packaged Extension icons, and engine-specific controlled favicons independent from the custom accent.

#### Scenario: A low-contrast color is selected

- **GIVEN** the user selects a base color that would be difficult to distinguish on the active theme surface
- **WHEN** Panerelay resolves its accent roles
- **THEN** it preserves the selected hue where possible while adjusting the rendered accent to meet the required contrast
- **AND** it chooses a readable foreground for controls filled with that accent

#### Scenario: Theme mode changes

- **GIVEN** a custom base accent is selected
- **WHEN** the user changes between Light, Dark, and a resolved System theme
- **THEN** Panerelay recalculates the accent roles for the active surface without discarding the stored base color

### Requirement: Extension-owned accent surfaces stay consistent

Panerelay SHALL use the selected accent for the controlled-tab action badge and SHALL refresh the badge while it is visible when the preference changes. Changing appearance SHALL NOT request site permission, authorize a tab, acquire or renew a control lease, or change the controlled-tab count.

#### Scenario: Accent changes while the control badge is visible

- **GIVEN** one or more tabs are controlled and the action badge is visible
- **WHEN** the user selects another accent color
- **THEN** the badge updates to the resolved accent with readable badge text
- **AND** its existing controlled-tab count remains unchanged

#### Scenario: Appearance changes without browser authority

- **GIVEN** no tab is authorized or controlled
- **WHEN** the user changes the accent color or theme mode
- **THEN** Panerelay updates only presentation state
- **AND** it does not request site permission, authorize a target, or acquire browser control
