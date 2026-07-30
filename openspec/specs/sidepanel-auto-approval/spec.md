# sidepanel-auto-approval Specification

## Purpose

Define a visible, user-controlled convenience policy for automatically accepting Side Panel Agent execution requests without broadening browser or operating-system authority.

## Requirements

### Requirement: Automatic Agent approval is explicit and default off

PaneRelay SHALL expose a visible automatic-approval toggle in the Side Panel, SHALL keep it disabled by default, and SHALL persist an explicit user choice locally for later Side Panel sessions.

#### Scenario: First use requires manual approval

- **GIVEN** the user has never enabled automatic approval
- **WHEN** an Agent requests permission to run a command, change files, or use a protected tool
- **THEN** PaneRelay displays the normal approval card and waits for a user decision

#### Scenario: Enabling automatic approval

- **GIVEN** the Side Panel is connected to a ready Agent provider
- **WHEN** the user enables automatic approval
- **THEN** PaneRelay visibly marks the mode as enabled and stores that preference locally

#### Scenario: Disabling automatic approval

- **GIVEN** automatic approval is enabled
- **WHEN** the user disables it
- **THEN** new and still-pending requests require the normal manual approval workflow

### Requirement: Automatic approval accepts only current Side Panel Agent requests

While enabled, PaneRelay SHALL automatically choose a one-request acceptance for command, file-change, and tool approval requests belonging to the current Side Panel conversation when that decision is offered. It MUST NOT synthesize an unsupported decision or approve an unrelated conversation or external-Agent request.

#### Scenario: Current conversation requests execution

- **GIVEN** automatic approval is enabled and the current conversation requests command, file-change, or tool permission with an `accept` decision
- **WHEN** PaneRelay receives the approval request
- **THEN** it submits the one-request acceptance exactly once and lets the Agent continue

#### Scenario: Pending request exists when mode is enabled

- **GIVEN** the current conversation already shows a pending approval
- **WHEN** the user enables automatic approval
- **THEN** PaneRelay attempts the same bounded one-request acceptance exactly once

#### Scenario: Provider lacks one-request acceptance

- **GIVEN** an approval request offers no `accept` decision
- **WHEN** automatic approval evaluates the request
- **THEN** PaneRelay leaves the request visible for manual handling and does not substitute session-wide acceptance

#### Scenario: Approval response fails

- **GIVEN** PaneRelay attempted automatic acceptance
- **WHEN** the provider rejects the response or the approval is no longer pending
- **THEN** PaneRelay preserves or restores actionable approval feedback and reports the failure

#### Scenario: Request belongs to another conversation

- **GIVEN** an approval event does not belong to the currently displayed conversation
- **WHEN** automatic approval is enabled
- **THEN** PaneRelay ignores it in that Side Panel controller and does not send an approval response

### Requirement: Automatic Agent approval does not change browser authority

Automatic approval SHALL NOT accept Chrome optional permissions, authorize a tab or origin, acquire or renew a control lease, transfer control, or override a browser action that fails the existing authorization and ownership checks.

#### Scenario: Agent requests browser access without authorization

- **GIVEN** automatic Agent approval is enabled but the target tab lacks site authorization or a current control lease
- **WHEN** the Agent attempts a browser action
- **THEN** PaneRelay keeps the browser action failed closed and requires the existing explicit browser authorization flow
