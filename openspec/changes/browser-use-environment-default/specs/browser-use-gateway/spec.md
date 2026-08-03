## Purpose

Provide a stable local Browser Use CDP discovery URL while preserving dynamic authorization, browser selection, participant lifecycle, and revocation through the existing Panerelay relay.

## ADDED Requirements

### Requirement: Stable Browser Use discovery endpoint

The integration SHALL expose a fixed user-scoped loopback HTTP URL whose `/json/version` discovery request can be used directly as `BU_CDP_URL` by Browser Harness. The URL SHALL remain stable across Browser Relay restarts and SHALL be recorded in protected setup state.

#### Scenario: Official Browser Use discovers Panerelay

- **WHEN** Browser Harness requests the fixed endpoint's `/json/version` path
- **THEN** the gateway SHALL resolve the saved Browser default, create or reuse the appropriate Browser Use participant through the selected Browser Relay, and return valid CDP version metadata with a usable WebSocket URL

#### Scenario: No browser is available

- **WHEN** the fixed endpoint is requested while no eligible authorized Panerelay browser is registered
- **THEN** it SHALL return a bounded unavailable error and SHALL not create a participant or expose a fallback browser

#### Scenario: Multiple browsers are registered

- **WHEN** more than one eligible browser is registered
- **THEN** the gateway SHALL use the same saved default selection rules as agent-browser and SHALL fail explicitly when no unambiguous default exists

### Requirement: Dynamic participant security behind the fixed URL

The gateway SHALL keep participant allocation and WebSocket credentials dynamic even though the discovery URL is fixed. Each discovery request SHALL be bound to the selected browser generation and the Browser Use lane, and stale, revoked, occupied, or disconnected state SHALL fail closed.

#### Scenario: Browser generation changes

- **WHEN** the selected browser or Native Host generation changes between discovery and WebSocket connection
- **THEN** the old participant or credential SHALL be invalidated and the next discovery request SHALL resolve the current generation

#### Scenario: Extension revokes authorization

- **WHEN** the Extension or Bridge revokes the selected target or closes the Browser Relay
- **THEN** the Browser Use WebSocket SHALL be closed or become unusable and a later discovery request SHALL not reuse the revoked participant

#### Scenario: Concurrent Browser Use startup

- **WHEN** multiple Browser Use processes request discovery concurrently for the same default lane
- **THEN** the gateway SHALL serialize or reject the requests according to the existing Browser Use lane policy and SHALL not create uncontrolled duplicate participants

### Requirement: Same-user loopback boundary

The gateway SHALL bind only to loopback, reject unsupported methods and paths, avoid permissive CORS, bound request/response sizes and timeouts, and document that any same-user local process able to access loopback is within the trust boundary.

#### Scenario: Remote request

- **WHEN** a request arrives from a non-loopback interface
- **THEN** the gateway SHALL not serve the Browser Use discovery or WebSocket route

#### Scenario: Invalid discovery request

- **WHEN** a client supplies an unsupported method, query, path, or malformed request
- **THEN** the gateway SHALL return a bounded error without disclosing browser registration, tokens, page content, or credentials
