## MODIFIED Requirements

### Requirement: `/json/version` consumption allocates the participant lazily

The ticket-specific HTTP base URL SHALL expose only the bounded DevTools version bootstrap needed by compatible clients. A valid `GET <base>/json/version` or `GET <base>/json/version/` SHALL atomically resolve or create one participant and return a no-store response containing its virtual `webSocketDebuggerUrl`. Ticket issuance alone SHALL never consume a participant slot. The bootstrap SHALL preserve the requested engine, actor, lane, browser binding, and connection policy when allocating the participant.

#### Scenario: Valid ticket is consumed

- **GIVEN** a valid unexpired ticket has not completed a WebSocket handshake
- **WHEN** a client requests its `/json/version` endpoint with or without a trailing slash
- **THEN** the Bridge creates at most one participant using the ticket's actor, engine, lane, and browser generation
- **AND** it returns CDP version metadata and the participant-scoped virtual WebSocket URL

#### Scenario: Client repeats `/json/version` before connecting

- **GIVEN** a valid ticket has already produced a participant but its WebSocket has not connected
- **WHEN** the same client repeats either accepted version path within the ticket and connection window
- **THEN** the Bridge returns the same participant metadata idempotently
- **AND** it does not allocate another participant

#### Scenario: Ticket expires without use

- **GIVEN** a ticket was issued but no client requested its version endpoint before expiry
- **WHEN** the expiry time passes
- **THEN** the Bridge deletes the ticket
- **AND** no participant, lease, target, or cleanup request is produced

#### Scenario: Ticket path is invalid or expired

- **GIVEN** a client presents an unknown, expired, consumed, or wrong-generation ticket
- **WHEN** it requests `/json/version`, `/json/version/`, or another bootstrap path
- **THEN** the Bridge returns an explicit bounded HTTP error
- **AND** it does not reveal live ticket, participant, registration, or authorization details
