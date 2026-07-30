## Why

Panerelay's first-run path still assumes users can translate setup, Native Messaging, Provider, and Chrome authorization failures into the right recovery action. Before the first stable release, the README and side panel should make installation, optional default selection, authorization, and active control understandable without requiring knowledge of the underlying architecture.

## What Changes

- Keep the README quick start explicit and non-invasive: installation registers Panerelay but does not make it the default agent-browser Provider.
- Keep every existing setup CLI default-Provider option, and additionally add side-panel settings actions to set Panerelay as the user-level default Provider or remove that default when it currently selects Panerelay.
- Detect an unavailable Native Host connection and show a compact setup command plus a retry action in the Extension.
- Show the controlled tabs for the active external Agent and let the user activate or close an individual tab without duplicating browser-authorization release controls.
- Turn missing all-tabs authorization and missing Panerelay agent-browser plugin failures into actionable guidance that points users to the Extension and the relevant setup action.
- Present the internal MCP server identifier `panerelay_browser` as the concise user-facing label `panerelay` in activity cards without renaming the integration.
- Keep permission requests user initiated in the Extension; Agents may surface and focus the authorization guidance but cannot silently grant Chrome permissions.
- Preserve agent-browser `0.33.0` as the minimum and verified baseline. The affected compatibility groups are Provider startup, target discovery, tab management, and authorization failure handling.

### Non-goals and ownership limits

- Do not automatically change agent-browser's default Provider during installation.
- Do not let the Extension install native software, run setup commands, or modify project files.
- Do not let an Agent grant Chrome site permissions, authorize tabs, or steal an existing control lease.
- Do not expose raw Chrome tab IDs as public protocol identifiers or add browser-process capabilities excluded by RFC-0002.
- Do not reinterpret every generic agent-browser plugin failure as a Panerelay installation failure without a recognized error signature.

## Capabilities

### New Capabilities

- `guided-browser-readiness`: Covers Native Host readiness, actionable browser authorization and plugin setup failures, and Extension-side default Provider controls.

### Modified Capabilities

- `control-session-lifecycle`: Expand the Extension's visible control state from a target count to browser-local controlled-tab summaries with per-tab activation and close actions.
- `stable-distribution`: Keep CLI and Extension default-Provider controls while making the README installation path non-defaulting, documenting how to set or clear a default without uninstalling Panerelay, and generating one public beta ordinal per workflow run.

## Impact

- Root English and Chinese README quick-start and default-Provider guidance.
- Extension side-panel settings, localization, runtime messages, and controlled-tab presentation.
- Native Host and shared protocol integration messages for reading and updating the user-level default Provider.
- Existing Extension-local controlled-tab state and bounded UI-side failure classification; no Chrome tab identifiers are added to the shared protocol.
- Existing setup CLI behavior plus reusable configuration helpers for idempotent Extension-initiated set/clear operations without removing the Native Host integration.
- agent-browser `0.33.0` compatibility coverage for target creation, tab management, Provider/plugin discovery, and Chrome authorization failures.
