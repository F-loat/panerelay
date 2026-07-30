# control-session-lifecycle Specification

## Purpose

Define how Panerelay proves that an external automation lease remains responsive, exposes its lifecycle to the browser UI, and releases every controlled target when the lease ends.

## Requirements

### Requirement: Allocation and active lease expiry are distinct

Panerelay SHALL distinguish the short Provider connection window from the liveness deadline of a connected control session.

#### Scenario: Provider never connects

- **GIVEN** the Bridge allocated a relay session and issued a short-lived CDP credential
- **WHEN** no authenticated transport connects before the allocation window closes
- **THEN** Panerelay expires the allocation without attaching a browser target

#### Scenario: Provider connects in time

- **GIVEN** an allocated relay session is still inside its connection window
- **WHEN** an authenticated CDP transport connects
- **THEN** Panerelay starts active lease liveness tracking independently of the original connection deadline

### Requirement: Responsive transports renew the control session

Panerelay SHALL renew active lease liveness only from authenticated transport connection, CDP command, or WebSocket heartbeat acknowledgement.

#### Scenario: One transport remains responsive

- **GIVEN** agent-browser opened multiple authenticated transports for one relay session
- **WHEN** at least one transport acknowledges heartbeat before the deadline
- **THEN** Panerelay keeps the control session live

#### Scenario: Unauthenticated connection attempt

- **GIVEN** a client does not hold the active relay session credential
- **WHEN** it connects or sends network traffic to the Bridge
- **THEN** Panerelay rejects it and does not renew the active lease

### Requirement: Unresponsive sessions expire closed

Panerelay SHALL expire an active control session when every authenticated transport exceeds the heartbeat deadline.

#### Scenario: Every transport misses heartbeat

- **GIVEN** a connected control session owns one or more controlled targets
- **WHEN** every authenticated transport becomes unresponsive past the heartbeat deadline
- **THEN** Panerelay closes the transports, fails pending operations, and detaches every controlled target

#### Scenario: Expiry races with a pending command

- **GIVEN** a CDP command is awaiting an Extension response
- **WHEN** the control session expires
- **THEN** the Agent observes session failure and Panerelay does not replay a late result

### Requirement: Terminal sessions never revive

Panerelay SHALL require a newly allocated session ID and credential after release, expiry, failure, or Bridge restart.

#### Scenario: Stale transport reconnects

- **GIVEN** a prior control session reached a terminal state
- **WHEN** a client reconnects with its former credential
- **THEN** Panerelay rejects the connection without restoring its lease or target attachments

#### Scenario: User releases control

- **GIVEN** an external Agent owns the active control session
- **WHEN** the user selects the immediate release action
- **THEN** Panerelay terminates the session without waiting for its heartbeat deadline

### Requirement: Control-session status is visible

Panerelay SHALL publish a provider-neutral summary of the current external control actor, lifecycle state, controlled-target count, and coarse heartbeat freshness.

#### Scenario: External Agent becomes active

- **GIVEN** an authenticated Agent connects and sends a target-scoped command
- **WHEN** the Bridge attaches the selected authorized target
- **THEN** the Extension receives status identifying the actor and active controlled-target count

#### Scenario: Session reaches a terminal state

- **GIVEN** the Extension displayed an active external control session
- **WHEN** the session is released, expired, or failed
- **THEN** the Extension receives the terminal state and no longer presents the Agent as actively controlling a target
