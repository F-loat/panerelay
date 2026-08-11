## ADDED Requirements

### Requirement: Consecutive activity results stay compact by default

The Side Panel SHALL present an uninterrupted run of two or more normalized conversation activities as one collapsed activity group. The collapsed group summary SHALL expose the number of activities, the latest activity title, and an aggregate status that does not hide a running, failed, or declined activity. An open group SHALL use a neutral activity-log heading instead of repeating the latest activity title and SHALL show every constituent activity in timeline order as one lightweight list rather than as nested full-size cards. Each list row SHALL expose its individual title and status, and each terminal row SHALL remain independently expandable to reveal the same complete title, bounded output, and detail available to an individually rendered activity. A single activity SHALL keep its existing direct card presentation. The Side Panel MUST NOT group activities across a message, reasoning, approval, or error boundary, and presentation compaction MUST NOT merge or remove the individual normalized activities from retained timeline snapshots, event replay, or conversation diagnostics.

#### Scenario: Several commands run between messages

- **GIVEN** two or more activity items occur consecutively between conversation messages
- **WHEN** the Side Panel renders the timeline
- **THEN** it shows one collapsed activity group in that position instead of one top-level card per activity
- **AND** the group summary shows the activity count, latest activity title, and aggregate outcome

#### Scenario: User opens a compact activity group

- **GIVEN** a collapsed activity group contains completed, failed, declined, or running activities
- **WHEN** the user expands the group
- **THEN** the group heading no longer repeats the latest activity title
- **AND** every activity appears in original timeline order as a compact list row with its individual title and status
- **AND** the rows do not repeat the full-size card border and icon treatment of the outer group
- **AND** each terminal activity still exposes its complete title, bounded output, and detail

#### Scenario: Activity boundaries remain visible

- **GIVEN** activity runs are separated by an assistant message, reasoning item, approval, or error
- **WHEN** the Side Panel renders the timeline
- **THEN** it keeps the separating item in place and does not combine activities from opposite sides of that boundary

#### Scenario: One activity occurs by itself

- **GIVEN** a timeline activity is not consecutive with another activity
- **WHEN** the Side Panel renders it
- **THEN** it keeps the existing single activity card presentation without an extra grouping disclosure

#### Scenario: Compact presentation is retained and diagnosed

- **GIVEN** a visible activity group represents several normalized activity items
- **WHEN** Panerelay saves or restores the conversation timeline or copies conversation diagnostics
- **THEN** every original activity remains represented as an individual ordered record
- **AND** compaction does not change provider events, browser authorization, control ownership, or automation execution
