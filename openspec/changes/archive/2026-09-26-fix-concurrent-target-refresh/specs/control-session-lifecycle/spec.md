## MODIFIED Requirements

### Requirement: Active target discovery expands only through controlled relationships

Panerelay SHALL seed a discovery lease with the eligible target inventory returned by its initial target-list request. After that seed, Panerelay SHALL expose a new target only when the Agent created it or Chrome reports that it was opened from a currently controlled tab through `openerTabId` or `webNavigation.onCreatedNavigationTarget`. An ordinary tab opened independently during the active discovery lease SHALL remain absent from target lifecycle events and later target-list responses. A target discovered after a target-list request begins SHALL remain available through that request's reconciliation, including its participant-local sessions, until a later authoritative removal or revocation.

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

#### Scenario: Concurrent target creation and stale list

- **GIVEN** two participants share an authorized all-tabs lease and one participant has a target-list request in flight
- **WHEN** the other participant creates and attaches a new target before the older list response arrives without that target
- **THEN** the new target remains listed and its page session remains usable
- **AND** a later current list response that omits the target removes it and its page session

#### Scenario: Target destroyed during a pending list

- **GIVEN** a target-list request is in flight
- **WHEN** the Extension reports a target destruction or the user revokes authorization
- **THEN** Panerelay invalidates the affected session immediately and a stale list response MUST NOT restore it

#### Scenario: Discovery lease ends

- **GIVEN** the active discovery lease has a bounded exposed-target inventory
- **WHEN** the final participant ends or browser authorization is released
- **THEN** Panerelay clears that inventory so a future lease can seed a new initial inventory
