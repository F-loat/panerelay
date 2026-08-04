## ADDED Requirements

### Requirement: Page-comment UI follows the resolved Extension appearance

PaneRelay SHALL apply the resolved Side Panel light or dark palette and custom accent roles to page-comment highlights, markers, touch guidance, and editors. It SHALL update existing page-comment presentation when appearance changes while preserving pending comments, selection state, authorization, and page lifecycle behavior.

#### Scenario: Page-comment mode starts with a custom accent

- **GIVEN** the user selected a valid custom accent and the active page has current PaneRelay site authorization
- **WHEN** the user starts page-comment mode
- **THEN** its highlight, markers, and editor use the resolved custom accent and active light or dark palette

#### Scenario: Appearance changes while page comments are active

- **GIVEN** page-comment mode or pending page comments are active on an authorized page
- **WHEN** the user changes the accent or resolved light or dark theme
- **THEN** existing Extension-owned page-comment UI updates to the new appearance
- **AND** pending comments, current selection mode, temporary page previews, and target bindings remain unchanged

#### Scenario: Page-comment appearance update loses authorization

- **GIVEN** the page-comment document is no longer authorized or available
- **WHEN** Panerelay attempts to forward a new appearance
- **THEN** it fails closed without reinjecting UI, widening authorization, or attaching comments to another document
