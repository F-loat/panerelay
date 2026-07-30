## MODIFIED Requirements

### Requirement: Control-session status is visible

Panerelay SHALL publish a provider-neutral summary of the current external control actor, lifecycle state, controlled-target count, and coarse heartbeat freshness. The Extension SHALL combine that summary with its existing browser-local controlled-tab state and let the user activate or explicitly close a controlled browser tab. The external-control summary SHALL NOT duplicate the browser-authorization release action.

#### Scenario: External Agent becomes active

- **GIVEN** an authenticated Agent connects and sends a target-scoped command
- **WHEN** the Bridge attaches the selected authorized target
- **THEN** the Extension receives status identifying the actor and active controlled-target count

#### Scenario: User inspects controlled tabs

- **GIVEN** the active control session owns one or more current browser tabs
- **WHEN** the user expands the external-control details
- **THEN** the Extension shows recognizable labels from its private controlled-tab mapping without exposing raw Chrome tab IDs through the shared protocol

#### Scenario: User activates a controlled tab

- **GIVEN** a controlled tab still exists in the current browser
- **WHEN** the user selects its label in settings
- **THEN** Chrome activates that tab without changing authorization or control ownership

#### Scenario: User closes one controlled tab

- **GIVEN** an external Agent controls multiple tabs
- **WHEN** the user explicitly closes one tab from settings
- **THEN** Chrome closes that tab, Panerelay detaches its target, and the remaining session and tabs keep their existing ownership

#### Scenario: User views the external-control summary

- **GIVEN** an external Agent controls one or more current browser tabs
- **WHEN** the Extension renders the external-control summary
- **THEN** the summary offers expansion and per-tab actions without a whole-session release button

#### Scenario: Controlled target disappears

- **GIVEN** a controlled target was closed by the user, page, or Agent
- **WHEN** the next status update is rendered
- **THEN** the Extension removes it from the controlled-tab list and does not offer a stale action

#### Scenario: Session reaches a terminal state

- **GIVEN** the Extension displayed an active external control session
- **WHEN** the session is released, expired, or failed
- **THEN** the Extension receives the terminal state and no longer presents the Agent or any tab as actively controlled
