## Why

The Side Panel can start and resume Agent conversations, but a new conversation is not oriented to the user's project or current page, and page-specific feedback must be rewritten manually. Agent approval cards also require repetitive clicks even when the user has explicitly chosen to trust the current Side Panel workflow.

## What Changes

- Let the user select or clear an optional local project directory before a new conversation starts. The Native Host validates the system-picked directory, and the selected directory becomes the conversation working directory without becoming a filesystem permission boundary.
- Give a newly created conversation bounded current-page context containing the active page URL and title. Raw Chrome tab IDs remain Extension-private and never enter Agent prompts or the shared protocol.
- Add a Mearl-aligned page-comment workflow: single-click one-shot selection, double-click continuous selection, animated desktop and touch selection, a viewport-aware element-anchored editor themed with the Side Panel, direct color controls and optional live style annotations, editable pencil markers, Side Panel annotation pills, and clearly delimited untrusted evidence on send.
- Let users paste bounded image files into the two-line composer, review or remove thumbnails, and send text, comments, and/or images through image-capable Codex and Qoder conversations.
- Add a persistent, default-off automatic-approval toggle for Agent command, file-change, and tool approval requests. It chooses a one-request acceptance only when the provider offers one; it does not grant Chrome site access, acquire browser control, or bypass unsupported decisions.
- Keep newly discovered or created browser targets virtual through agent-browser's page-session bootstrap so opening a tab alone does not increase the controlled-tab count or replace its favicon.
- Update RFC-0001, RFC-0002, and the agent-browser `0.33.0` compatibility record with the context, approval, and target-bootstrap boundaries.

Non-goals:

- Exposing raw Chrome tab IDs, page cookies, DOM contents beyond explicitly commented elements, automatically captured screenshots, request bodies, or credentials as initial context.
- Treating a selected project as authorization to read or mutate files.
- Automatically approving Chrome permissions, tab authorization, control leases, browser handoff, or unrelated external-Agent requests.
- Changing agent-browser automation semantics, target selection rules, or its pinned `0.33.0` compatibility baseline.

## Capabilities

### New Capabilities

- `sidepanel-agent-context`: Covers project-directory selection, bounded initial page metadata, and explicit page-element comments for new and active Side Panel conversations.
- `sidepanel-auto-approval`: Covers the user-controlled automatic handling and visibility of Side Panel Agent approval requests.

### Modified Capabilities

- `control-session-lifecycle`: Distinguishes virtual target bootstrap from actual page control in controlled-target visibility.

## Impact

- `@panerelay/protocol`: provider-neutral conversation-start context, bounded image input, and Native Host integration request/result types.
- `@panerelay/bridge`: cross-platform directory picker and validation, Codex/Qoder working-directory, initial-context, and image-input handling, and tests.
- `@panerelay/extension`: tab-workspace directory state, Mearl-aligned page-comment runtime and Side Panel controls, pasted-image previews and validation, approval preference/orchestration, localized copy, and component/background tests.
- `docs/rfcs/0001-extension-connection-and-agent-interoperability.md`: records that selected project and page context do not alter authorization or ownership.
- `docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md`: records that page-session auto-attach setup is deferred until a substantive page command.
- `docs/compatibility/agent-browser-0.33.0.md`: adds Side Panel provider-session coverage; connection/page automation and target lifecycle compatibility groups remain unchanged.
