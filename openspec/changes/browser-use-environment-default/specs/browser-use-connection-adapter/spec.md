## MODIFIED Requirements

### Requirement: Browser Use adapter resolves an authorized connection

The Browser Use integration SHALL resolve an Extension-mode connection to the fixed setup-managed Browser Use gateway URL rather than returning a per-invocation ticket URL. When a one-run browser selection is supplied, it SHALL return a scoped URL on that gateway which binds the request to the selected browser ID and generation. The gateway SHALL perform ticket creation, participant allocation, and WebSocket routing. Direct mode SHALL remain an explicit configuration that removes the Panerelay Browser Harness environment override.

#### Scenario: Resolve Extension mode

- **WHEN** the Browser Use integration is configured for Extension mode and a live eligible browser exists
- **THEN** the effective Browser Use environment SHALL contain the fixed gateway `BU_CDP_URL` and SHALL not contain a Bridge bearer or raw per-invocation ticket

#### Scenario: Resolve Extension mode for an explicit browser

- **WHEN** the Browser Use integration is configured for Extension mode and a one-run browser selection is supplied
- **THEN** the effective Browser Use environment SHALL contain a scoped gateway `BU_CDP_URL` bound to that browser ID and generation, and SHALL not contain a Bridge bearer or raw per-invocation ticket

#### Scenario: Resolve Direct mode

- **WHEN** the Browser Use integration is configured for Direct mode
- **THEN** the effective Browser Use environment SHALL not select the Panerelay gateway

#### Scenario: Resolve unavailable browser

- **WHEN** Extension mode is selected but browser selection or gateway startup cannot produce an eligible authorized browser
- **THEN** the integration SHALL report a bounded unavailable error and SHALL not invoke Browser Use against another browser or Direct Chrome

### Requirement: Browser Use integration configuration

The Browser Use integration SHALL own setup, doctor, mode selection, and cleanup of the Panerelay Browser Harness environment keys and fixed gateway state. The generic CLI SHALL retain engine-neutral browser selection and configuration primitives but SHALL not be required to wrap every Browser Use invocation.

#### Scenario: Mode selection changes bare Browser Use behavior

- **WHEN** `connection use browser-use extension` or the equivalent Extension settings action succeeds
- **THEN** a newly started official Browser Use CLI or CLI MCP process SHALL use the Panerelay environment default

#### Scenario: Mode selection does not alter agent-browser

- **WHEN** Browser Use mode is changed
- **THEN** the agent-browser Provider default, browser selection default, and unrelated adapter registrations SHALL remain unchanged
