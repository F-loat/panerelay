## Why

Long Agent turns can leave the Side Panel dominated by a separate card for every command and tool result, pushing the useful conversation out of view. Mearl demonstrates that turn progress can remain understandable without permanently presenting every intermediate tool step at full timeline height.

## What Changes

- Compact two or more consecutive conversation activities into one collapsed activity group in the Side Panel.
- Keep the current activity and aggregate outcome visible in the group summary, with every original activity title, status, output, and detail available after expansion.
- Present expanded groups as one lightweight activity list rather than nesting full-size activity cards, and replace the open group heading with a neutral activity-log label so the latest title is not repeated.
- Keep a single activity card unchanged when it is not part of a consecutive run, and keep approvals, reasoning, messages, errors, and their ordering unchanged.
- Preserve the normalized timeline, retained snapshot, event replay, and diagnostic export exactly as individual activity records; compaction is presentation-only.
- Treat browser ownership, site authorization, control leases, provider event normalization, and automation execution as non-goals. The pinned agent-browser 0.33.0 integration and all browser-engine compatibility groups are unaffected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-workflow`: Consecutive activity results use a compact, expandable presentation without losing individual terminal details.

## Impact

- Affects the Extension Side Panel conversation renderer, activity styling, localization, and component tests.
- Does not change shared protocol types, provider adapters, storage schemas, browser attachment, CDP behavior, dependencies, or compatibility matrices.
- Applies uniformly to normalized activity from Codex, Qoder, Claude Code, and OpenCode conversations.
