## Why

The setup CLI currently asks users to type comma-separated integration numbers, which is error-prone and does not behave like a true multiselect. A keyboard-driven prompt should make the one-selection setup flow clear while preserving flags and non-interactive automation.

## What Changes

- Replace the free-form integration question with a localized terminal multiselect for agent-browser, Browser Use, and Playwright CLI.
- Use one localized yes/no prompt for the shared user-default choice when a selected integration supports defaults.
- Treat prompt cancellation as a clean cancellation before setup changes begin.
- Remove the post-setup informational sentence that repeats how to select optional integrations.
- Keep explicit flags and non-interactive setup behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `setup-cli-localization`: Define keyboard multiselect, cancellation, and concise output behavior for interactive setup.

## Impact

- `packages/setup` gains a small runtime prompt dependency and replaces its readline-based setup prompts.
- Setup CLI tests use structured selection hooks instead of simulating comma-separated input.
- The public setup flags and lifecycle APIs remain unchanged.

## Non-goals and compatibility

- This change does not alter Extension permissions, tab ownership, CDP routing, or browser automation semantics.
- It does not change or pin the supported agent-browser version; compatibility remains at the existing minimum of agent-browser 0.33.0 and uses the existing compatibility groups.
- It does not add installation prompts per automation engine or make Playwright a user-level default.
