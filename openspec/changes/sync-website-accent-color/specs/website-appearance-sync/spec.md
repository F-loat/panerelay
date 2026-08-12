## Purpose

Keep Panerelay's official website visually aligned with the local Extension accent while preserving a safe default and every existing browser-authorization boundary.

## ADDED Requirements

### Requirement: Official website can read the local Extension accent palette

The Extension SHALL expose one versioned, read-only appearance connection to the explicitly allowlisted production website route. It SHALL return only a validated website accent palette and SHALL NOT return other Extension storage, browser state, page data, Agent data, permissions, or credentials.

#### Scenario: Installed Extension supplies the current palette

- **GIVEN** the official website is open in the same browser profile as an installed compatible Panerelay Extension
- **WHEN** the website opens the supported appearance connection
- **THEN** the Extension returns a validated palette derived from the user's current accent-color setting

#### Scenario: Unsupported external sender is rejected

- **GIVEN** an external connection has an unexpected name, origin, route, or sender shape
- **WHEN** it reaches the Extension
- **THEN** the Extension disconnects it without returning Extension state

### Requirement: Open official website pages follow accent changes

The Extension SHALL publish a validated website accent palette to connected official website pages after its stored accent color changes. Each connected website page SHALL apply a valid palette to the existing website accent custom properties without requiring a reload.

#### Scenario: Accent changes while the website is open

- **GIVEN** an official website page has an active appearance connection
- **WHEN** the user selects a different valid accent color in the Side Panel
- **THEN** the open website page updates its accent presentation to the corresponding palette

#### Scenario: Website connection is re-established

- **GIVEN** the browser closes an appearance connection while the website remains open
- **WHEN** the compatible Extension remains available
- **THEN** the website retries after a bounded delay and applies the current palette from the replacement connection

### Requirement: Appearance synchronization fails safely

The official website SHALL keep its checked-in default palette when no compatible Extension connection or valid palette is available. Appearance synchronization SHALL NOT request Chrome Host Permission, grant Panerelay site permission or tab authorization, attach a debugger, expose a tab to an Agent, create an Agent session, or acquire a browser-control lease.

#### Scenario: Extension is absent

- **GIVEN** a visitor opens the official website without the compatible Extension installed
- **WHEN** the website attempts optional appearance synchronization
- **THEN** the page remains functional and retains its default palette without showing an error

#### Scenario: Extension sends malformed appearance data

- **GIVEN** a website appearance connection receives malformed or unsupported data
- **WHEN** the website validates the message
- **THEN** it ignores the message and retains the last valid palette or its checked-in default

#### Scenario: Website appearance connects without browser authority

- **GIVEN** the user has granted no Panerelay site permission or tab authorization to the website tab
- **WHEN** the official website reads or receives the appearance palette
- **THEN** the tab remains unauthorized and uncontrolled
