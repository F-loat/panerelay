## MODIFIED Requirements

### Requirement: Control-session status is visible

Panerelay SHALL publish a provider-neutral summary of the shared browser control lease, current active participant actor, participant count, lifecycle state, observed-target count, controlled-target count, and coarse heartbeat freshness. A target SHALL be counted as observed while Chrome's debugger is attached only for passive setup or an explicitly classified read-only command, and SHALL be counted as controlled after a control-class command is accepted for that target. The Extension SHALL combine that summary with its existing browser-local controlled-tab state and let the user activate or explicitly close a controlled browser tab. The external-control summary SHALL NOT duplicate the browser-authorization release action.

#### Scenario: Participant becomes active

- **GIVEN** multiple authenticated participants share the control lease
- **WHEN** one participant sends a target-scoped command
- **THEN** the Extension receives status identifying that participant as the current actor without hiding the total participant count

#### Scenario: Participant ends while another remains

- **GIVEN** the Extension displays a shared control lease with multiple participants
- **WHEN** one participant is released, expired, or failed
- **THEN** the Extension updates the participant count and continues to show the responsive lease

#### Scenario: User inspects observed and controlled totals

- **GIVEN** the active session has debugger attachments used for observation and active control
- **WHEN** the user expands the external-control details
- **THEN** the Extension shows separate observed-target and controlled-target totals without including observed targets in the controlled total

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

- **GIVEN** an external Agent observes or controls one or more current browser tabs
- **WHEN** the Extension renders the external-control summary
- **THEN** the summary offers expansion, describes both states, and keeps whole-session release available through browser authorization

#### Scenario: Controlled target disappears

- **GIVEN** a controlled target was closed by the user, page, or Agent
- **WHEN** the next status update is rendered
- **THEN** the Extension removes it from the controlled-tab list and does not offer a stale action

#### Scenario: Lease reaches a terminal state

- **GIVEN** the Extension displayed an active shared control lease
- **WHEN** every participant ends or browser authorization is revoked
- **THEN** the Extension receives the terminal state and no longer presents any Agent or tab as observed or actively controlled

### Requirement: Virtual target bootstrap does not imply page control

Panerelay SHALL keep target discovery and flattened page-session creation virtual. Panerelay MAY attach Chrome's debugger when agent-browser requests passive domain observation or an explicitly classified read-only page command, but SHALL NOT treat that observation attachment as active page control.

#### Scenario: A new target receives passive setup

- **GIVEN** agent-browser discovers or creates an eligible browser tab
- **WHEN** it creates a flattened page session and enables page, runtime, network, or child-target observation
- **THEN** Panerelay may attach Chrome's debugger and preserve events without increasing the controlled-target or controlled-tab count or replacing that page's favicon

#### Scenario: The target receives an allowlisted read-only command

- **GIVEN** a page session is virtual or observed
- **WHEN** the Agent sends an explicitly classified read-only command
- **THEN** Panerelay forwards the command, reports the target as observed, and leaves the controlled count and current favicon unchanged

#### Scenario: The target receives its first control-class command

- **GIVEN** a page session is virtual or observed
- **WHEN** the Agent sends a navigation, interaction, mutation, emulation, or ambiguous command
- **THEN** Panerelay upgrades the target to controlled before forwarding the command, reports one controlled target, and marks the current document favicon

#### Scenario: Protocol setup runs on an already controlled target

- **GIVEN** a target is already debugger-attached and its current document is not marked
- **WHEN** Panerelay forwards passive setup or wakes an auto-attached child session
- **THEN** the setup does not itself replace the top-level page favicon

## ADDED Requirements

### Requirement: Read-only classification fails closed

Panerelay SHALL classify observation using an explicit method allowlist shared by the Bridge and Extension. Commands not present in the allowlist SHALL be treated as control-class commands even when their CDP domain commonly contains read operations.

#### Scenario: Arbitrary JavaScript is evaluated

- **GIVEN** an observed target receives `Runtime.evaluate` or `Runtime.callFunctionOn`
- **WHEN** Panerelay classifies the command
- **THEN** Panerelay treats it as control because arbitrary script execution can mutate the page

#### Scenario: Unknown CDP method is routed

- **GIVEN** a target-scoped method is supported by routing policy but absent from the read-only allowlist
- **WHEN** Panerelay classifies the command
- **THEN** Panerelay upgrades the target to controlled before forwarding it

#### Scenario: Read-only command follows active control

- **GIVEN** a target was already upgraded to controlled
- **WHEN** a later allowlisted read-only command is sent
- **THEN** the target remains controlled until detach or complete lease release

### Requirement: Observation and control share revocation

Panerelay SHALL detach both observed and controlled targets when their final participant reference ends or the user releases browser authorization.

#### Scenario: Complete lease is released

- **GIVEN** the lease contains observed and controlled debugger attachments
- **WHEN** the user releases browser authorization or the final participant ends
- **THEN** Panerelay detaches every attachment, clears both counts, and restores any surviving controlled-page favicon

### Requirement: Active target discovery expands only through controlled relationships

Panerelay SHALL seed a discovery lease with the eligible target inventory returned by its initial target-list request. After that seed, Panerelay SHALL expose a new target only when the Agent created it or Chrome reports that it was opened from a currently controlled tab through `openerTabId` or `webNavigation.onCreatedNavigationTarget`. An ordinary tab opened independently during the active discovery lease SHALL remain absent from target lifecycle events and later target-list responses.

#### Scenario: User independently opens a new tab

- **GIVEN** agent-browser has initialized the active discovery lease
- **WHEN** the user opens an otherwise eligible tab without a controlled opener relationship
- **THEN** Panerelay does not publish that tab, agent-browser does not initialize it, and neither observed nor controlled totals change

#### Scenario: Controlled page opens a related tab

- **GIVEN** a source tab has already been upgraded to controlled
- **WHEN** Chrome reports a new eligible tab with that source through `openerTabId` or `onCreatedNavigationTarget`
- **THEN** Panerelay publishes the new target exactly once and agent-browser may initialize it as observed

#### Scenario: Observed page opens a related tab

- **GIVEN** a source tab is only observed and has not received a control-class command
- **WHEN** Chrome reports a new tab opened from that source
- **THEN** Panerelay does not expand target discovery to the new tab

#### Scenario: Agent explicitly creates a tab

- **GIVEN** the active lease permits all-tabs target creation
- **WHEN** agent-browser issues `Target.createTarget`
- **THEN** Panerelay exposes the created target even though it has no controlled opener relationship

#### Scenario: Agent lists targets again

- **GIVEN** an independently opened ordinary tab was withheld during the active discovery lease
- **WHEN** agent-browser later calls `Target.getTargets` again or another participant joins the same lease
- **THEN** the withheld tab remains absent while the initial and trusted-derived target inventory remains available

#### Scenario: Discovery lease ends

- **GIVEN** the active discovery lease has a bounded exposed-target inventory
- **WHEN** the final participant ends or browser authorization is released
- **THEN** Panerelay clears that inventory so a future lease can seed a new initial inventory
