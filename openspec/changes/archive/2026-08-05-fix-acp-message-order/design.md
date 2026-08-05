## Context

`ConversationEvent` already carries `messageId` on `message.delta`, and ACP history normalization already uses the provider message ID. The live ACP path instead stores one `assistantMessageId` and one accumulated `assistantText` per turn. This mismatch loses ACP message boundaries. OpenCode can send commentary, tool activity, and a later final answer in the same turn; the Extension correctly appends timeline items in event order, but a later delta targeting the first message updates that earlier item in place.

## Decisions

### Use ACP message IDs as the live correlation key

For `agent_message_chunk`, use the non-empty ACP `messageId` as the normalized `message.delta.messageId`. When it is absent, use the existing turn-scoped fallback ID. This preserves provider-declared message boundaries without guessing whether text is commentary or final output.

### Complete messages independently

The active turn stores ordered assistant message accumulators keyed by normalized message ID. Each accumulator receives only its own bounded text. When the ACP prompt returns, the Bridge emits `message.completed` for every accumulated message in first-seen order, followed by usage and turn completion as today. A message with no text produces no completion event.

This keeps streaming messages replaceable in the existing reducer and ensures each message loses its `streaming` marker independently. It also avoids concatenating messages that were separated by tool events.

### Preserve event order and existing boundaries

No buffering or timestamp-based sorting is added. The Extension timeline remains an event-order projection: a message is placed when its first delta arrives; activity updates remain correlated replacements; a new message ID creates a new item at the current position. Browser authorization and control-lease semantics are outside this change.

## Risks and mitigations

- A provider may omit `messageId`: retain a stable per-turn fallback so its chunks still form one message.
- A provider may reuse one ID across commentary and final text: Panerelay cannot safely split provider-declared content, so it preserves that provider boundary.
- ACP may send a completion message with no streamed text: the current adapter still has no normalized completion payload to synthesize; this change only completes messages observed through text chunks.

## Verification

- Unit-test the shared ACP provider with two message IDs separated by a tool update and assert two ordered completion events.
- Unit-test the Side Panel reducer with message A, activity B, and message C and assert `[A, B, C]` plus independent text updates.
- Run the Bridge/Extension scoped tests and full repository checks.
- Review the pinned OpenCode/Qoder compatibility notes; no browser fixture or browser ownership behavior is changed.
