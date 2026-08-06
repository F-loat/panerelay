## ADDED Requirements

### Requirement: Settings heading displays the Extension semantic release

The Side Panel SHALL display the current Extension semantic `version_name` immediately beside the localized Settings title. The version SHALL be available without a Native Host connection, SHALL preserve the complete stable or prerelease identity, and SHALL remain visually secondary to the title and non-interactive heading actions.

#### Scenario: Stable Extension opens settings

- **GIVEN** the installed Extension manifest has stable `version_name` `0.7.0`
- **WHEN** the user opens Side Panel settings
- **THEN** the heading displays `v0.7.0` immediately beside the localized Settings title
- **AND** diagnostic and GitHub actions retain their existing position and accessible names

#### Scenario: Beta Extension opens settings

- **GIVEN** the installed Extension manifest has prerelease `version_name` `0.8.0-beta.42`
- **WHEN** the user opens Side Panel settings
- **THEN** the heading exposes the complete `v0.8.0-beta.42` identity without substituting the numeric Chromium build version

#### Scenario: Native Host is unavailable

- **GIVEN** the Native Host is missing, disconnected, updating, or on a different release
- **WHEN** the user opens settings
- **THEN** the Extension release remains visible from local manifest metadata
- **AND** its display does not claim Host readiness or browser authorization

### Requirement: Host update state does not replace normal connected operation

The Side Panel SHALL keep Native Messaging transport, browser registration, Host maintenance, and browser authorization as separate state. A pending or failed background update SHALL NOT make a normally registered Host appear disconnected, hide available Agent functionality, disable integration or authorized automation actions, or render the missing-Host installation guide. Restart-pending MAY show reconnect feedback while the successfully replaced Host exits and reconnects.

#### Scenario: Older Host begins automatic update

- **GIVEN** normal browser registration completed through an older Host
- **WHEN** the Side Panel receives update-running state
- **THEN** it keeps the connection and available Host-backed actions usable
- **AND** any update indication remains secondary to normal connected operation

#### Scenario: Exact package is unavailable

- **GIVEN** automatic update cannot resolve the exact setup package
- **WHEN** the Host quietly contains that failure
- **THEN** the Side Panel keeps the existing connection and ordinary interface available
- **AND** it does not show the missing-Host guide, clear authorization, or claim the Host was updated

#### Scenario: Updated Host restarts

- **GIVEN** self-update succeeded and the old Host reported restart-pending
- **WHEN** the Native Messaging port disconnects and reconnects
- **THEN** the Side Panel may show localized reconnect feedback until the replacement registers
- **AND** it then restores normal connected presentation without starting another automatic update attempt

#### Scenario: Host is newer than the Extension

- **GIVEN** registration reports a Host release newer than the Extension
- **WHEN** the Side Panel renders status
- **THEN** normal connection and available functionality remain visible
- **AND** it does not offer or imply an automatic downgrade

### Requirement: Version maintenance does not change authorization presentation

The Side Panel SHALL keep the user's existing authorization selection separate from Host version comparison, update attempt, failure, and reconnect. Maintenance status SHALL NOT grant, widen, revoke, or exercise browser authority.

#### Scenario: Background update fails with a saved authorization selection

- **GIVEN** the user has an existing tab-authorization selection
- **WHEN** Host update fails while the connection stays active
- **THEN** the same selection remains visible
- **AND** no authorization request or control action is emitted by the maintenance flow
