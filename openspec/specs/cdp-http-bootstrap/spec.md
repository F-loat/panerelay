# cdp-http-bootstrap Specification

## Purpose

Define a secure loopback HTTP bootstrap that lets CDP clients resolve a short-lived virtual browser WebSocket without exposing the Bridge bearer credential or allocating unused automation participants.

## Requirements

### Requirement: Bootstrap tickets require authenticated local issuance

The Bridge SHALL issue CDP bootstrap tickets only through an authenticated loopback request using the current live browser registration. Each ticket SHALL be random, short-lived, bound to one browser and Native Host generation, scoped to a bounded automation actor, stored only in memory, and subject to issuance and outstanding-ticket limits.

#### Scenario: Registered adapter requests a ticket

- **GIVEN** an adapter has selected one live CDP-capable browser registration
- **WHEN** it submits a valid authenticated bootstrap request with a bounded automation actor
- **THEN** the Bridge returns a no-store loopback HTTP base URL and expiry time
- **AND** it does not return the Bridge bearer credential
- **AND** no participant, lease, target, or WebSocket is created yet

#### Scenario: Request is unauthenticated or malformed

- **GIVEN** a process does not possess the current Bridge bearer credential or supplies an invalid actor payload
- **WHEN** it requests a bootstrap ticket
- **THEN** the Bridge rejects the request without creating a ticket, participant, lease, target, or browser activity state

#### Scenario: Outstanding ticket limit is reached

- **GIVEN** the Bridge already holds the bounded maximum of unexpired bootstrap tickets
- **WHEN** another adapter requests a ticket
- **THEN** the Bridge fails explicitly without evicting an active participant or widening browser access

### Requirement: `/json/version` consumption allocates the participant lazily

The ticket-specific HTTP base URL SHALL expose only the bounded DevTools version bootstrap needed by compatible clients. A valid `GET <base>/json/version` SHALL atomically resolve or create one participant and return a no-store response containing its virtual `webSocketDebuggerUrl`. Ticket issuance alone SHALL never consume a participant slot.

#### Scenario: Valid ticket is consumed

- **GIVEN** a valid unexpired ticket has not completed a WebSocket handshake
- **WHEN** a client requests its `/json/version` endpoint
- **THEN** the Bridge creates at most one participant using the ticket's actor and browser generation
- **AND** it returns CDP version metadata and the participant-scoped virtual WebSocket URL

#### Scenario: Client repeats `/json/version` before connecting

- **GIVEN** a valid ticket has already produced a participant but its WebSocket has not connected
- **WHEN** the same client repeats the version request within the ticket and connection window
- **THEN** the Bridge returns the same participant metadata idempotently
- **AND** it does not allocate another participant

#### Scenario: Ticket expires without use

- **GIVEN** a ticket was issued but no client requested its version endpoint before expiry
- **WHEN** the expiry time passes
- **THEN** the Bridge deletes the ticket
- **AND** no participant, lease, target, or cleanup request is produced

#### Scenario: Ticket path is invalid or expired

- **GIVEN** a client presents an unknown, expired, consumed, or wrong-generation ticket
- **WHEN** it requests `/json/version` or another bootstrap path
- **THEN** the Bridge returns an explicit bounded HTTP error
- **AND** it does not reveal live ticket, participant, registration, or authorization details

### Requirement: WebSocket credentials are scoped to one bootstrap connection

The virtual CDP WebSocket URL returned by the HTTP bootstrap SHALL contain only a participant-scoped, short-lived connection credential. For a single-connection bootstrap policy, the credential SHALL become unusable after the first successful WebSocket handshake; a disconnected client SHALL obtain a new bootstrap ticket rather than reconnect with a logged or stale URL.

#### Scenario: First WebSocket handshake succeeds

- **GIVEN** a participant was allocated from a valid bootstrap ticket within its connection window
- **WHEN** the compatible CDP client completes the authorized WebSocket handshake
- **THEN** the Bridge marks the connection credential consumed
- **AND** subsequent handshakes using the same URL are rejected
- **AND** the connected WebSocket remains valid until transport, heartbeat, revocation, or Native Host termination ends it

#### Scenario: WebSocket never connects

- **GIVEN** `/json/version` allocated a participant
- **WHEN** no valid WebSocket connects before the participant connection window expires
- **THEN** the Bridge releases that participant and any associated ticket state
- **AND** it emits no target attachment or browser mutation

#### Scenario: A second client races the first

- **GIVEN** two clients possess the same participant-scoped WebSocket URL
- **WHEN** one client completes the successful handshake first
- **THEN** the other handshake fails explicitly
- **AND** both clients cannot share or expand the participant authority

### Requirement: Bootstrap transport remains local, private, and bounded

Bootstrap and virtual CDP endpoints SHALL bind only to loopback, SHALL omit permissive CORS headers, SHALL reject unsupported methods and paths, SHALL bound request sizes and timeouts, and SHALL NOT log bearer credentials, bootstrap tickets, participant credentials, page content, cookies, screenshots, prompts, or CDP request bodies by default.

#### Scenario: Web page attempts to call bootstrap APIs

- **GIVEN** an arbitrary browser page can reach loopback networking
- **WHEN** it sends an unauthenticated request, a cross-origin preflight, or an unsupported method to the bootstrap service
- **THEN** the Bridge returns no permissive CORS grant and no usable connection material

#### Scenario: Oversized or slow request arrives

- **GIVEN** a client sends a request beyond the documented size or time bound
- **WHEN** the Bridge processes the request
- **THEN** it rejects or terminates the request without retaining partial credentials or allocating participant state

### Requirement: Bootstrap state follows revocation and Native Host lifecycle

Extension authorization changes SHALL remain independent of ticket possession. Authorization loss or Native Host shutdown SHALL invalidate affected tickets and participants, close connected virtual CDP transports, detach owned targets, and prevent a stale bootstrap URL from authorizing a later Native Host generation.

#### Scenario: Authorization is revoked before WebSocket connection

- **GIVEN** a valid bootstrap ticket or allocated participant exists without a connected WebSocket
- **WHEN** the user revokes the relevant browser authorization
- **THEN** the Bridge invalidates the pending connection material
- **AND** a later HTTP or WebSocket request fails closed

#### Scenario: Native Host generation changes

- **GIVEN** a ticket or virtual CDP URL was issued by one Native Host process
- **WHEN** that process exits and the Extension establishes a new Native Host generation
- **THEN** all connection material from the previous generation is invalid
- **AND** the new process does not restore its participants, tickets, leases, targets, or credentials
