## Why

Live and restored Side Panel conversations can differ in ordering or completeness, but users currently have no structured way to capture the exact normalized state that Panerelay rendered. A user-triggered diagnostic copy makes those discrepancies reproducible without enabling default transcript logging.

## What Changes

- Add a Debug-icon action near the bottom of Side Panel settings, immediately before the GitHub action, that copies the current conversation's normalized diagnostic record to the clipboard. Hide the action when there is no current conversation or timeline content to diagnose.
- Preserve the rendered timeline order and include typed entries for messages, reasoning, activities, approvals, and errors with their available correlation identifiers and statuses. Retain conversation message text while reducing reasoning and activity output to size metadata.
- Include bounded environment metadata needed to interpret the record, such as schema version, capture time, selected provider descriptor, conversation summary, current turn state, and whether the workspace is a draft.
- Show localized success or failure feedback without changing the conversation.
- Add a lightweight copy action to every user and assistant message card. The action appears on hover or keyboard focus and copies that card's original Markdown source without diagnostic metadata.
- Keep the export user-triggered and derived only from state already held by the Side Panel.

Non-goals:

- Do not add automatic logging, persistence, upload, telemetry, or support-ticket submission.
- Do not fetch or copy raw ACP/CDP traffic, cookies, credentials, screenshots, request bodies, page DOM, browser profile data, hidden provider prompts, reasoning text, or raw activity output for the export.
- Do not repair message ordering or history restoration as part of this change; the copied record is intended to make those follow-up fixes diagnosable.
- Do not change browser authorization, control ownership, tab focus, or automation semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-workflow`: Add an explicit, privacy-bounded diagnostic copy action for the current normalized conversation timeline.

## Impact

- Affects the Extension Side Panel settings/actions, conversation message cards, state serialization, localization, styles, and component tests.
- Does not change the shared protocol or Bridge APIs because all exported data already exists in Side Panel memory.
- OpenCode 1.18.12 and Qoder 1.1.2 are the immediately affected diagnostic workflows; Codex and other providers receive the same provider-neutral action.
- The agent-browser 0.33.0, Browser Use 0.13.7 / Browser Harness 0.1.8, and Playwright CLI 0.1.17 browser compatibility groups are unchanged.
