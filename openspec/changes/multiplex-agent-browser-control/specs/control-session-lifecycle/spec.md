## MODIFIED Requirements

### Requirement: Allocation and active lease expiry are distinct

Panerelay SHALL distinguish each Provider participant's short connection window from the liveness deadline of the shared browser control lease.

#### Scenario: Participant never connects

- **GIVEN** the Bridge allocated a participant and issued a short-lived CDP credential
- **WHEN** no authenticated transport for that participant connects before its allocation window closes
- **THEN** Panerelay expires only that participant without attaching a browser target or terminating responsive participants

#### Scenario: First participant connects in time

- **GIVEN** no browser control lease exists and an allocated participant is inside its connection window
- **WHEN** an authenticated CDP transport connects
- **THEN** Panerelay starts a browser control lease and tracks that participant independently of the original connection deadline

#### Scenario: Additional participant connects

- **GIVEN** a browser control lease already has a responsive participant
- **WHEN** another authenticated local agent-browser participant connects
- **THEN** Panerelay joins it to the existing lease without requiring a new browser authorization or detaching controlled targets

### Requirement: Responsive transports renew the control session

Panerelay SHALL track liveness per participant from that participant's authenticated transport connection, CDP command, or WebSocket heartbeat acknowledgement, and SHALL keep the browser control lease live while at least one participant remains responsive.

#### Scenario: One transport for a participant remains responsive

- **GIVEN** one participant opened multiple authenticated transports
- **WHEN** at least one of its transports acknowledges heartbeat before the deadline
- **THEN** Panerelay keeps that participant and the shared control lease live

#### Scenario: One of multiple participants remains responsive

- **GIVEN** the control lease contains multiple participants
- **WHEN** one participant expires but another participant remains responsive
- **THEN** Panerelay removes the expired participant without ending the lease or disconnecting the responsive participant

#### Scenario: Unauthenticated connection attempt

- **GIVEN** a client does not hold a current participant credential
- **WHEN** it connects or sends network traffic to the Bridge
- **THEN** Panerelay rejects it and does not join or renew the shared lease

### Requirement: Unresponsive sessions expire closed

Panerelay SHALL expire an unresponsive participant independently and SHALL end the shared browser control lease only when every participant is gone or unresponsive.

#### Scenario: One participant misses heartbeat

- **GIVEN** multiple participants share the active browser control lease
- **WHEN** every transport for one participant exceeds the heartbeat deadline
- **THEN** Panerelay closes that participant's transports, fails its pending operations, and keeps targets referenced by another participant attached

#### Scenario: Every participant misses heartbeat

- **GIVEN** the shared control lease owns one or more controlled targets
- **WHEN** every participant becomes unresponsive past its heartbeat deadline
- **THEN** Panerelay closes all transports, fails pending operations, ends the lease, and detaches every controlled target

#### Scenario: Participant expiry races with a pending command

- **GIVEN** one participant's CDP command is awaiting an Extension response
- **WHEN** that participant expires
- **THEN** the participant observes session failure and Panerelay does not replay a late result to another participant

### Requirement: Terminal sessions never revive

Panerelay SHALL require a newly allocated participant ID and credential after that participant is released, expired, or failed. Ending one participant SHALL NOT terminate other responsive participants, while browser authorization revocation SHALL terminate the complete shared lease.

#### Scenario: Stale participant reconnects

- **GIVEN** a prior participant reached a terminal state
- **WHEN** a client reconnects with its former credential
- **THEN** Panerelay rejects the connection without restoring its participant state or virtual target sessions

#### Scenario: Provider releases one participant

- **GIVEN** multiple participants share the active browser control lease
- **WHEN** one Provider closes its participant
- **THEN** Panerelay disconnects that participant and keeps the other participants and their target sessions live

#### Scenario: User revokes browser authorization

- **GIVEN** one or more participants share the active browser control lease
- **WHEN** the user releases browser authorization
- **THEN** Panerelay terminates every participant and detaches every controlled target immediately

### Requirement: Control-session status is visible

Panerelay SHALL publish a provider-neutral summary of the shared browser control lease, current active participant actor, participant count, lifecycle state, controlled-target count, and coarse heartbeat freshness.

#### Scenario: Participant becomes active

- **GIVEN** multiple authenticated participants share the control lease
- **WHEN** one participant sends a target-scoped command
- **THEN** the Extension receives status identifying that participant as the current actor without hiding the total participant count

#### Scenario: Participant ends while another remains

- **GIVEN** the Extension displays a shared control lease with multiple participants
- **WHEN** one participant is released, expired, or failed
- **THEN** the Extension updates the participant count and continues to show the responsive lease

#### Scenario: Lease reaches a terminal state

- **GIVEN** the Extension displayed an active shared control lease
- **WHEN** every participant ends or browser authorization is revoked
- **THEN** the Extension receives the terminal state and no longer presents any Agent as actively controlling a target
