## MODIFIED Requirements

### Requirement: Conversation sessions can orient agent-browser to one exact target

Panerelay SHALL derive a canonical versioned agent-browser session name of no more than 64 characters from a conversation's opaque browser and target hint, SHALL use only characters accepted by agent-browser 0.33.0, SHALL reversibly bind that Provider session to the named live browser registration, and SHALL make the hinted authorized target the session-local `t1` during initial target discovery. The binding MUST NOT grant authorization or a control lease and MUST fail before publishing a fallback `t1` when the hint cannot be resolved or the reserved session value is malformed, non-canonical, or uses the unusable legacy overlong format.

#### Scenario: Hinted target is available

- **GIVEN** agent-browser 0.33.0 starts a new Panerelay Provider session with the injected compact versioned session name
- **AND** the session name satisfies agent-browser's 64-character and character-set constraints
- **AND** the hinted target belongs to that live browser and is in the participant's authorized target set
- **WHEN** agent-browser performs initial target discovery
- **THEN** the hinted target receives the session-local handle `t1`
- **AND** subsequent commands in that session address it without matching URL or title

#### Scenario: Hinted target is stale or belongs to another browser

- **GIVEN** the injected session names a missing target, a replaced browser registration, or a target outside that browser's authorized set
- **WHEN** agent-browser launches the Panerelay Provider or discovers targets
- **THEN** Panerelay returns an explicit target-unavailable failure
- **AND** `t1` is not assigned to another target

#### Scenario: Reserved session is malformed or obsolete

- **GIVEN** a session starts with the current compact target prefix or the legacy overlong target prefix but does not contain one complete canonical current encoding
- **WHEN** agent-browser launches the Panerelay Provider
- **THEN** Panerelay rejects the session before selecting a default browser
- **AND** it does not assign `t1` from ordinary target ordering

#### Scenario: Agent continues normal tab work after orientation

- **GIVEN** the hinted target was assigned `t1`
- **WHEN** the Agent lists, creates, selects, or closes tabs using normal agent-browser commands
- **THEN** existing session-local tab identity, controlled-lineage discovery, authorization, and control behavior remain in effect
