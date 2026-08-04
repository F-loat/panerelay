## MODIFIED Requirements

### Requirement: Qoder events are provider neutral at the Extension boundary

Panerelay SHALL normalize Qoder text, reasoning, plan, tool, usage, completion, cancellation, and error updates into the shared conversation event model before sending them to the Extension. For terminal tool updates, Panerelay SHALL preserve bounded displayable ACP text content as activity output separately from failure detail, while excluding images, terminal handles, raw input, raw output, metadata, and provider-native objects.

#### Scenario: Qoder streams a turn

- **GIVEN** an active Qoder ACP prompt emits thought, message, plan, and tool updates
- **WHEN** Panerelay forwards the turn to the Side Panel
- **THEN** the panel receives bounded normalized events associated with the correct conversation and turn

#### Scenario: Qoder tool completes with text content

- **GIVEN** Qoder completes an ACP tool call and publishes displayable text content
- **WHEN** Panerelay normalizes the terminal tool update
- **THEN** the conversation activity contains the bounded text as output
- **AND** it contains no ACP raw input, raw output, metadata, image, terminal handle, or provider-native object

#### Scenario: Qoder emits an unknown provider-native update

- **GIVEN** a Qoder version emits an ACP update Panerelay does not support
- **WHEN** the Bridge receives it
- **THEN** Panerelay does not expose the raw provider object or claim successful normalized behavior
