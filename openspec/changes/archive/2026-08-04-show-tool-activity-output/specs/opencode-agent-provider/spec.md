## MODIFIED Requirements

### Requirement: OpenCode events are provider neutral at the Extension boundary

Panerelay SHALL normalize OpenCode assistant text, reasoning, tool activity, usage, completion, cancellation, and bounded errors into the shared conversation event model before sending them to the Extension. For terminal tool updates, Panerelay SHALL preserve bounded displayable ACP text content as activity output separately from failure detail, while excluding images, terminal handles, raw input, raw output, metadata, and provider-native objects. Unknown ACP updates SHALL be ignored with a sanitized diagnostic or SHALL fail the affected operation, and MUST NOT cross Native Messaging as raw objects.

#### Scenario: OpenCode streams a turn

- **GIVEN** an active OpenCode prompt emits message, thought, tool, and usage updates
- **WHEN** Panerelay forwards the turn to the Side Panel
- **THEN** the panel receives bounded normalized events associated with the correct conversation and turn

#### Scenario: OpenCode tool completes with text content

- **GIVEN** OpenCode completes an ACP tool call and publishes displayable text content
- **WHEN** Panerelay normalizes the terminal tool update
- **THEN** the conversation activity contains the bounded text as output
- **AND** it contains no ACP raw input, raw output, metadata, image, terminal handle, or provider-native object

#### Scenario: OpenCode emits an unknown update

- **GIVEN** an OpenCode version emits an ACP update Panerelay does not normalize
- **WHEN** the Bridge receives it
- **THEN** Panerelay does not expose the raw update or claim successful normalized behavior
