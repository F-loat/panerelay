## Why

Repeated interactive setup runs currently start with empty integration choices even when Panerelay integrations and defaults are already configured. Unchecked integrations are also treated only as skipped work, so the interactive selection cannot express the desired installed state. Setup should initialize from current protected configuration and reconcile Panerelay-owned integration artifacts to the submitted selection while keeping live validation and explicit CLI flags authoritative.

## What Changes

- Read current valid Panerelay Provider, adapter registration, and user-level default state before every unflagged interactive prompt.
- Preselect every currently configured Panerelay integration and initialize the shared default confirmation to `Yes` only when every selected default-capable integration currently uses Panerelay as its default.
- Treat the submitted interactive multiselect as the desired Panerelay integration state: install or update checked integrations and remove Panerelay-owned Provider, adapter, configuration, and default artifacts for unchecked integrations.
- Make the prompt explicitly state that unchecked integrations are removed, while preserving upstream agent-browser, Browser Use, and Playwright CLI installations and user-owned configuration.
- Show localized timer feedback while submitted interactive setup changes are being applied, with distinct success and failure completion states.
- Keep setup completion focused on applied components by omitting the separate optional Agent-tools group; retain that environment information in doctor.
- Keep explicit integration flags, `--global-default`, `--yes`, non-interactive invocations, cancellation, and first-run behavior unchanged.
- Treat current configuration as prompt presentation only until the user submits: reading setup state does not install or remove tools, grant browser authority, or bypass validation.
- Non-goals: uninstalling upstream automation engines, deleting unrelated user configuration, retaining arbitrary command-line history, inferring selections from executable discovery alone, changing browser routing ownership, or changing agent-browser 0.33.0 and other versioned compatibility classifications.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `setup-cli-localization`: Interactive setup reflects current Panerelay integration state, reconciles checked and unchecked integrations as the desired installed state, reports pending work, and keeps completion output focused on applied components.

## Impact

- Affected code: `packages/setup/src/cli.ts`, `packages/setup/src/i18n.ts`, `packages/setup/src/lifecycle.ts`, setup documentation, and focused setup CLI/lifecycle/configuration tests.
- Reuses existing protected agent-browser Provider configuration, CLI adapter registry, and Browser Use preference readers without adding a second persisted selection state or changing storage formats.
- No shared protocol, Extension, Bridge, browser authorization, control lease, upstream automation engine, or external dependency behavior changes. The interactive setup selection changes from additive-only to desired-state reconciliation; explicit flag invocations remain additive-only.
- Compatibility remains unchanged: agent-browser 0.33.0 stays the pinned baseline and no compatibility group is promoted or reclassified.
