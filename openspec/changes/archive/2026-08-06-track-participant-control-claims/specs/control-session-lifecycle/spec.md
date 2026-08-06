## MODIFIED Requirements

### Requirement: Terminal sessions never revive

Panerelay SHALL require a newly allocated participant ID and credential after that participant is released, expired, or failed. Ending one participant SHALL remove that participant's target-control claims without terminating other responsive participants, while explicit authorization-scope revocation or a user-requested whole-lease release SHALL terminate the complete shared lease.

#### Scenario: Stale participant reconnects

- **GIVEN** a prior participant reached a terminal state
- **WHEN** a client reconnects with its former credential
- **THEN** Panerelay rejects the connection without restoring its participant state, virtual target sessions, or target-control claims

#### Scenario: Provider releases one participant

- **GIVEN** multiple participants share the active browser control lease and more than one participant controls the same target
- **WHEN** one Provider closes its participant
- **THEN** Panerelay disconnects that participant, removes its target-control claims, keeps the other participants and their target sessions live, and attributes the target to the most recent remaining live claim

#### Scenario: Provider releases the only controlling participant

- **GIVEN** a target remains debugger-attached for observation by one participant and is controlled only by another participant
- **WHEN** the controlling participant ends
- **THEN** Panerelay removes its claim, reports the target as observed, and restores the current document favicon without detaching the target

#### Scenario: User releases browser control

- **GIVEN** one or more participants share the active browser control lease and an authorization scope is selected
- **WHEN** the user activates the whole-lease release action
- **THEN** Panerelay terminates every participant and detaches every observed or controlled target immediately without clearing the selected authorization scope

#### Scenario: User clears browser authorization

- **GIVEN** one or more participants share the active browser control lease
- **WHEN** the user clears the selected authorization scope
- **THEN** Panerelay terminates every participant, detaches every observed or controlled target immediately, and leaves no target eligible for a new participant

### Requirement: Control-session status is visible

Panerelay SHALL publish a provider-neutral summary of the shared browser control lease, current active participant actor, participant count, lifecycle state, observed-target count, controlled-target count, and coarse heartbeat freshness. A target SHALL be counted as observed while Chrome's debugger is attached and no live participant holds a control claim for it, and SHALL be counted as controlled while one or more live participants hold a control claim acquired before a control-class command is forwarded. The Extension SHALL combine that summary with its existing browser-local controlled-tab state, attribute each marked current-document favicon to the most recent live control claim, and let the user activate or explicitly close a controlled browser tab. The external-control summary SHALL NOT duplicate the browser-authorization release action.

#### Scenario: Participant becomes active

- **GIVEN** multiple authenticated participants share the control lease
- **WHEN** one participant sends a target-scoped command
- **THEN** the Extension receives status identifying that participant as the current actor without hiding the total participant count

#### Scenario: Participant ends while another remains

- **GIVEN** the Extension displays a shared control lease with multiple participants
- **WHEN** one participant is released, expired, or failed
- **THEN** the Extension updates the participant count, removes that participant's control claims, and continues to show the responsive lease

#### Scenario: User inspects observed and controlled totals

- **GIVEN** the active session has debugger attachments with and without live control claims
- **WHEN** the user expands the external-control details
- **THEN** the Extension shows separate observed-target and controlled-target totals without including targets that have no live control claim in the controlled total

#### Scenario: User inspects controlled tabs

- **GIVEN** the active control session has live control claims for one or more current browser tabs
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

#### Scenario: Most recent controlling participant ends

- **GIVEN** two live participants hold control claims for the same marked current document and the newer claim determines its engine favicon
- **WHEN** the participant holding the newer claim ends while the older claim remains live
- **THEN** the Extension replaces the existing controlled favicon with the engine of the most recent remaining live claim without detaching the target

#### Scenario: Current document has no controlled marker

- **GIVEN** a target has navigated since a participant acquired a control claim and the current document has no Panerelay controlled favicon
- **WHEN** another participant's claim ends and an older live claim becomes the latest remaining claim
- **THEN** the Extension does not create a controlled favicon until a live participant sends a new control-class command to the current document

#### Scenario: Lease reaches a terminal state

- **GIVEN** the Extension displayed an active shared control lease
- **WHEN** every participant ends or browser authorization is revoked
- **THEN** the Extension receives the terminal state and no longer presents any Agent or tab as observed or actively controlled

### Requirement: Read-only classification fails closed

Panerelay SHALL classify observation using an explicit method allowlist shared by the Bridge and Extension. Commands not present in the allowlist SHALL be treated as control-class commands even when their CDP domain commonly contains read operations. A control-class command SHALL acquire or refresh the sending participant's target-control claim before forwarding, and Panerelay SHALL NOT inspect command parameters or arbitrary script content to weaken that classification.

#### Scenario: Arbitrary JavaScript is evaluated

- **GIVEN** an observed target receives `Runtime.evaluate` or `Runtime.callFunctionOn`
- **WHEN** Panerelay classifies the command
- **THEN** Panerelay treats it as control and acquires a participant target-control claim because arbitrary script execution can mutate the page

#### Scenario: Unknown CDP method is routed

- **GIVEN** a target-scoped method is supported by routing policy but absent from the read-only allowlist
- **WHEN** Panerelay classifies the command
- **THEN** Panerelay acquires or refreshes the sending participant's control claim before forwarding it

#### Scenario: Read-only command follows active control

- **GIVEN** a participant already holds a target-control claim
- **WHEN** that participant later sends an allowlisted read-only command
- **THEN** its claim remains live until that participant's final target reference ends, that participant ends, the target disappears, or the complete lease is released

### Requirement: Observation and control share revocation

Panerelay SHALL remove a participant's target-control claim when its final target reference ends or the participant ends. Panerelay SHALL detach both observed and controlled targets when their final participant reference ends, the user releases the complete browser-control lease, or the user clears or changes the selected authorization scope.

#### Scenario: One participant's final target reference ends

- **GIVEN** multiple participants reference the same debugger-attached target and one participant holds its most recent control claim
- **WHEN** that participant's final virtual page or child-session reference to the target ends
- **THEN** Panerelay removes only that participant's claim and keeps the target attached for remaining references

#### Scenario: A remaining participant still controls the target

- **GIVEN** removing one participant's claim leaves another live claim for the same target
- **WHEN** Panerelay updates target control state
- **THEN** the target remains controlled and the marked current document uses the most recent remaining claim's engine attribution

#### Scenario: No participant still controls the target

- **GIVEN** removing one participant's claim leaves no live claim but another participant still observes the target
- **WHEN** Panerelay updates target control state
- **THEN** the target becomes observed, the controlled count decreases, and the current document favicon is restored without detaching the target

#### Scenario: Complete lease is released

- **GIVEN** the lease contains observed and controlled debugger attachments
- **WHEN** the user releases browser control, clears or changes the authorization scope, or the final participant ends
- **THEN** Panerelay detaches every attachment, clears both counts and all participant claims, and restores any surviving controlled-page favicon
