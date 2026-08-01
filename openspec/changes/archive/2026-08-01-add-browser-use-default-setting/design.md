## Context

See [proposal.md](./proposal.md) for motivation. The current side-panel setting reaches the Bridge through the versioned `integration.request` boundary and conditionally edits agent-browser's user configuration. Browser Use already stores its Direct/Extension default in the protected engine-neutral Panerelay CLI adapter-preference file, but that state is only exposed through CLI commands. RFC-0001 owns the Extension-to-Bridge settings boundary and RFC-0007 owns Browser Use connection-mode semantics.

The separate browser-registration default remains browser-local routing state. It is only useful as a side-panel setting when more than one live browser connection exists. Browser authorization, active control, and default selection remain distinct. Existing agent-browser 0.33.0 and Browser Use 0.13.7 / internal runtime 0.1.8 evidence is unaffected because this change does not run either engine or change its connection path.

## Goals / Non-Goals

**Goals:**

- Let the side panel independently show and toggle Panerelay defaults for agent-browser and Browser Use.
- Reuse the Browser Use preference consumed by the existing CLI and Skill.
- Preserve protected local configuration ownership and bounded protocol results.
- Fit both engine actions in one compact row without decorative status dots.
- Present a “Control by default” switch only when multiple live browser connections make routing choice meaningful, without repeating the current browser name.
- Keep explicit browser authorization reachable from the main panel even while the selected Agent needs installation or setup.

**Non-Goals:**

- Do not combine the two defaults into one shared selection or make them mutually exclusive.
- Do not set Browser Use as the default merely because setup or the Extension connects.
- Do not start Browser Use, mint a CDP ticket, allocate a participant, or change authorization.
- Do not change the current-browser default's persistence, routing priority, authorization, or control semantics.

## Decisions

### Add a Browser Use-specific default operation to the generic integration envelope

The shared protocol will add `browser-use-default.get`, `.set`, and `.clear` requests and a bounded result containing only `available`, `mode`, and `isPanerelay`. Existing agent-browser and browser-default operations remain wire-compatible. The Extension refreshes both automation defaults after browser registration and clears their transient status on Native Host disconnect.

Alternative: overload `default-provider.*` with an engine identifier. Browser Use chooses a connection mode rather than an agent-browser Provider, so that name and result would misrepresent the setting and complicate compatibility with the existing operation.

### Reuse the Panerelay CLI registration and preference APIs inside the Bridge

The Bridge will take a runtime dependency on a side-effect-free `@panerelay/cli/adapter-config` public subpath, verify that the protected `browser-use` adapter registration exists, and read or write its existing mode preference. The CLI root remains executable-oriented and is not bundled into the Native Host. Enabling stores `extension`; clearing stores `direct`. The Bridge does not inspect Browser Use internals or duplicate the preference-file implementation.

Alternative: read and rewrite the JSON file directly in Bridge. That would duplicate permission validation, schemas, atomic writes, and adapter-ID rules across package boundaries. Removing the mode entry on clear would currently fall back to Direct, but storing Direct preserves an explicit reversible user choice and matches the existing CLI surface.

### Keep independent state and pending operations in the Extension

The status model adds Browser Use default state beside the existing agent-browser state. Separate pending flags prevent repeated clicks per engine without blocking the other toggle. A missing registration keeps the Browser Use button visible but disabled so the feature is discoverable and cannot create configuration for an uninstalled integration.

Alternative: infer Browser Use readiness from a running participant. Participants are connection lifecycle state, not installation/default state, and would make the UI inaccurate while idle.

### Use explicit control state instead of decorative indicators

The automation-default row will render two auto-width buttons in a right-aligned flex group. For those buttons, `aria-pressed`, border, background, and text color convey selection without a trailing indicator element. The separate current-browser preference uses a standard `role="switch"` control whose checked state is its only state affordance. Because the side panel already belongs to the current browser, the row does not repeat Chrome, Edge, Chromium, or another browser name.

### Derive default-control visibility from live browser registrations

The existing `browser-default.*` integration result will add one bounded `hasMultipleBrowsers` boolean. The Native Host Bridge reads the existing protected browser registry through `listBrowserRegistrations()` and sets the value from the number of live registrations, without returning their IDs, names, credentials, or count. The Extension renders the renamed `Control by default` / `默认受控` switch row only when the boolean is true. It refreshes this state when the Native Host registers and whenever settings open; an already-open settings panel may remain visible until the next refresh after another browser disconnects.

Alternative: count tabs, windows, or browser families in the Extension. Those values do not represent independent Native Host/browser registrations and would misstate routing choice. Returning the exact registration list or count would expose more cross-browser state than this UI needs.

### Gate Agent actions and browser authorization independently

The welcome surface will render its compact browser-authorization card whenever the Native Host and Bridge are connected. Provider readiness continues to control the suggestion buttons, conversation history, composer, and provider preparation. An unavailable selected Agent therefore keeps its setup guidance and disabled Agent actions while the user can still inspect, grant, change, or release the current browser scope. Provider selection does not invoke an authorization mutation.

Alternative: keep the authorization card inside the ready-provider suggestion block. That couples two independent readiness dimensions and makes the user switch away from the Agent they are configuring merely to prepare browser access.

## Risks / Trade-offs

- **[A stale adapter registration makes Browser Use appear available]** → Registry reads retain protected-path and schema validation; actual execution still performs adapter integrity and compatibility checks and fails closed.
- **[Two independent selected buttons look mutually exclusive]** → Use toggle-button semantics (`aria-pressed`) and allow both to be selected simultaneously rather than radio semantics.
- **[Bridge importing CLI creates a new package edge]** → The dependency is acyclic, uses the CLI's public preference/registry API, and is bundled into the Native Host like other workspace runtime code.
- **[Default mutation is mistaken for browser permission]** → Protocol and UI operations change local preferences only; tests assert no authorization, participant, or browser-default state changes.
- **[Another browser disconnects while settings remain open]** → The result is recomputed from live protected registrations on every browser-default refresh; the row becomes accurate when settings reopen without polling or cross-process notification machinery.
- **[Authorization appears usable although the selected Agent is unavailable]** → The card describes browser scope rather than Agent readiness; setup guidance and disabled conversation actions continue to make the unavailable Agent state explicit.

## Migration Plan

Ship the lockstep protocol, Bridge, and Extension changes together. Existing agent-browser and Browser Use preference files require no migration and are reread when the Native Host reconnects. Rolling back restores the former single toggle while leaving each previously saved default intact.
