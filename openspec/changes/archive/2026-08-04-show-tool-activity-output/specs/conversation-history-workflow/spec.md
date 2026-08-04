## MODIFIED Requirements

### Requirement: Terminal activity details remain readable

The Side Panel SHALL allow completed, failed, and declined activity cards to be expanded and collapsed. The expanded content SHALL show the complete original activity title followed by any bounded provider-supplied output and complete activity detail in distinct regions, while the collapsed summary MAY remain ellipsized for the narrow layout and MUST NOT expose output that was intended for the expanded view.

#### Scenario: Completed command title is truncated in the card

- **GIVEN** a completed command activity has a title wider than the compact card
- **WHEN** the user opens the activity card
- **THEN** the user can read and select the full original command and any available bounded output or detail

#### Scenario: Completed command has displayable output

- **GIVEN** a completed command activity contains bounded provider-supplied text output
- **WHEN** the Side Panel first renders the collapsed card
- **THEN** the compact summary does not display the output
- **AND** opening the card shows the wrapped, selectable output separately from the command title

#### Scenario: Failed activity has diagnostic detail

- **GIVEN** a failed or declined activity contains diagnostic detail
- **WHEN** the user opens the activity card
- **THEN** the same disclosure shows the full original title and diagnostic text without requiring a failure-only interaction

#### Scenario: Terminal activity has no secondary content

- **GIVEN** a completed, failed, or declined activity has neither an `output` nor a `detail` field
- **WHEN** the Side Panel renders the activity
- **THEN** the activity remains expandable so its full original title is available

#### Scenario: Activity is still running

- **GIVEN** an activity has not reached a terminal status
- **WHEN** the Side Panel renders the activity
- **THEN** its card remains non-expandable while provider updates can still replace its title, output, or detail
