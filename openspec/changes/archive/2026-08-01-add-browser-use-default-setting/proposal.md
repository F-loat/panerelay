## Why

Extension settings currently describe one agent-browser-specific control as “Default Provider,” even though Panerelay now supports independently choosing the default connection for Browser Use. Users should be able to make either installed automation engine use Panerelay by default from one compact, truthful settings row.

## What Changes

- Rename the Extension settings row from “Default Provider” to “Set as default” / “设为默认”.
- Show compact `agent-browser` and `Browser Use` toggle buttons in that row, without trailing circular indicators; selected button styling communicates the current state.
- Keep the agent-browser button mapped to the existing user-level `provider: panerelay` setting.
- Make the Browser Use button set its registered adapter preference to Extension mode, and return it to Direct mode when the Panerelay default is cleared.
- Disable the Browser Use action unless a valid setup-managed `browser-use` adapter registration declares the `extension` mode, without installing Browser Use or changing its configuration. A missing or mode-incompatible registration is unavailable, while an invalid protected registry returns a correlated error.
- Extend the versioned Extension/Native Host integration protocol and Bridge service with bounded Browser Use default-state operations.
- Rename the separate current-browser routing setting to “Control by default” / “默认受控”, replace the browser-family button and decorative indicator with a standard switch, and hide the row unless more than one live browser connection exists.
- Keep the main-panel browser-authorization card available when the selected Agent is not installed, while continuing to disable Agent conversation actions and show targeted setup guidance.

Non-goals include changing one-run overrides, making arbitrary Browser Use SDK construction transparent, starting a Browser Use daemon, granting browser permissions, authorizing tabs, acquiring control leases, changing browser ownership, or changing CDP behavior. The Browser Use 0.13.7 and Browser Harness 0.1.8 baseline evidence remains valid. The adapter and CDP implementation are unchanged, while saved Direct/Extension default routing is new behavior that selects the persisted lane for later launches.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `guided-browser-readiness`: Generalize the compact Extension default-setting row from one agent-browser Provider toggle to independent agent-browser and Browser Use default actions, show the current-browser routing default only when multiple live browsers make it meaningful, and keep browser authorization accessible independently of selected-Agent installation state.
- `browser-use-connection-adapter`: Allow the Extension to read and update the existing Browser Use Direct/Extension preference through the Bridge without affecting one-run overrides.

## Impact

This affects the shared integration protocol, Bridge integration service and runtime dependencies on the engine-neutral Panerelay CLI preference API and existing browser-registry query API, Extension background status and request routing, side-panel controller/state/UI/i18n/styles, tests, and RFC-0001/RFC-0006/RFC-0007. It does not alter the Browser Use adapter, CDP relay, Native Messaging authentication, browser registry storage, authorization, participant, target, lease, or cleanup semantics; the main-panel authorization change only removes an Agent-readiness rendering gate.
