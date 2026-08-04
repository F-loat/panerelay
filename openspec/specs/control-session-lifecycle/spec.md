# control-session-lifecycle Specification

## Purpose

Define how Panerelay proves that an external automation lease remains responsive, exposes its lifecycle to the browser UI, and releases every controlled target when the lease ends.

## Requirements

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

Panerelay SHALL require a newly allocated participant ID and credential after that participant is released, expired, or failed. Ending one participant SHALL NOT terminate other responsive participants, while explicit authorization-scope revocation or a user-requested whole-lease release SHALL terminate the complete shared lease.

#### Scenario: Stale participant reconnects

- **GIVEN** a prior participant reached a terminal state
- **WHEN** a client reconnects with its former credential
- **THEN** Panerelay rejects the connection without restoring its participant state or virtual target sessions

#### Scenario: Provider releases one participant

- **GIVEN** multiple participants share the active browser control lease
- **WHEN** one Provider closes its participant
- **THEN** Panerelay disconnects that participant and keeps the other participants and their target sessions live

#### Scenario: User releases browser control

- **GIVEN** one or more participants share the active browser control lease and an authorization scope is selected
- **WHEN** the user activates the whole-lease release action
- **THEN** Panerelay terminates every participant and detaches every observed or controlled target immediately without clearing the selected authorization scope

#### Scenario: User clears browser authorization

- **GIVEN** one or more participants share the active browser control lease
- **WHEN** the user clears the selected authorization scope
- **THEN** Panerelay terminates every participant, detaches every observed or controlled target immediately, and leaves no target eligible for a new participant

### Requirement: Authorization scope selection and lease release are independent

Panerelay SHALL present the current-tab and all-tabs authorization scopes as explicit toggle selections. Activating or clearing a scope SHALL revoke any current control lease, while the separate release action SHALL revoke the complete control lease without changing the selected authorization scope or Chrome site permission. The Extension SHALL expose that same whole-lease release action in browser access settings and in the Extension action icon's context menu.

#### Scenario: User activates an unselected scope

- **GIVEN** the requested authorization scope is not selected
- **WHEN** the user selects current-tab or all-tabs and completes any required Chrome permission prompt
- **THEN** Panerelay selects that scope, revokes any lease created under the previous scope, and exposes only targets eligible under the new scope

#### Scenario: User toggles off the selected current-tab scope

- **GIVEN** current-tab authorization is selected
- **WHEN** the user clicks the selected current-tab control again
- **THEN** Panerelay clears the local authorization selection, revokes the complete control lease if one exists, and does not remove the already granted Chrome site permission

#### Scenario: User toggles off the selected all-tabs scope

- **GIVEN** all-tabs authorization is selected
- **WHEN** the user clicks the selected all-tabs control again
- **THEN** Panerelay clears the local authorization selection, revokes the complete control lease if one exists, and does not remove the already granted Chrome web-origin permissions

#### Scenario: User releases browser control

- **GIVEN** current-tab or all-tabs authorization remains selected
- **WHEN** the user activates the release action
- **THEN** Panerelay revokes the complete control lease and detaches every observed or controlled target while preserving the selected scope and Chrome site permission

#### Scenario: User releases browser control from the action icon

- **GIVEN** the Extension is installed and current-tab or all-tabs authorization remains selected
- **WHEN** the user activates the localized whole-lease release item from the Extension action icon's context menu
- **THEN** Panerelay performs the same complete lease release as the browser access settings action and preserves the selected scope and Chrome site permission

#### Scenario: Release is used without an active lease

- **GIVEN** an authorization scope is selected and no control lease exists
- **WHEN** the user activates the release action
- **THEN** Panerelay leaves the selected scope unchanged and does not acquire control, expose a new target, or widen authorization

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

Panerelay SHALL detach both observed and controlled targets when their final participant reference ends, the user releases the complete browser-control lease, or the user clears or changes the selected authorization scope.

#### Scenario: Complete lease is released

- **GIVEN** the lease contains observed and controlled debugger attachments
- **WHEN** the user releases browser control, clears or changes the authorization scope, or the final participant ends
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
