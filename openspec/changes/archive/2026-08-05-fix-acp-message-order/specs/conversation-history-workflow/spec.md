## ADDED Requirements

### Requirement: ACP assistant message boundaries are preserved

The Bridge SHALL use each non-empty ACP assistant `messageId` as the correlation key for normalized live message events, and SHALL use one stable turn-scoped fallback when ACP omits a message ID.

#### Scenario: Multiple ACP messages share one turn

- **GIVEN** an active ACP turn emits assistant chunks with message IDs `commentary-1` and `final-1`
- **WHEN** the Bridge normalizes those chunks
- **THEN** it emits distinct normalized `message.delta` events for those IDs
- **AND** later chunks for each ID update only that message

#### Scenario: ACP omits a message ID

- **GIVEN** an active ACP turn emits assistant chunks without a usable message ID
- **WHEN** the Bridge normalizes those chunks
- **THEN** all such chunks use one stable fallback ID for that turn
- **AND** they remain one assistant message

### Requirement: Assistant messages retain chronological placement

The Side Panel SHALL place a newly observed assistant message at the point its first delta is received and SHALL NOT merge a later message into an earlier message merely because both belong to one turn.

#### Scenario: Final answer follows tool activity

- **GIVEN** the timeline receives message A, then a tool activity, then message B in one turn
- **WHEN** the Side Panel reduces those events
- **THEN** the timeline order is message A, tool activity, message B
- **AND** subsequent deltas for message B update only message B

### Requirement: Stream completion is per message

The Bridge SHALL emit one `message.completed` event for each streamed assistant message in first-seen order when the ACP prompt completes, and SHALL preserve the existing usage and turn terminal events after those message completions.

#### Scenario: Two streamed messages complete

- **GIVEN** an ACP turn streamed two non-empty assistant messages
- **WHEN** the prompt returns successfully
- **THEN** the Bridge emits two matching `message.completed` events with independent text
- **AND** it emits one completed turn event after both messages
