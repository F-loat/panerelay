## Why

The default setup command currently installs only the Native Host and leaves users to discover separate adapter flags. A first-run interactive flow can make the two independent integrations discoverable while letting users decide whether Panerelay should be the default connection for each selected engine.

## What Changes

- When the default `setup` command has neither `--agent-browser` nor `--browser-use`, prompt interactively for each integration.
- For every selected integration, prompt whether Panerelay should be configured as that engine's default: the user-level agent-browser Provider for agent-browser, and Extension connection mode for Browser Use.
- Preserve explicit flags as automation-friendly, non-interactive selection; `--yes`/`--non-interactive` skips the new prompts and keeps the current base-only behavior when no integration flag is supplied.
- Localize prompts, choices, cancellation/fallback messaging, and completion output in English and Simplified Chinese.
- Keep installation, authorization, browser ownership, and upstream engine configuration boundaries unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `stable-distribution`: Define interactive first-run selection and default configuration for optional automation integrations.
- `setup-cli-localization`: Localize and constrain the interactive setup flow while keeping machine-oriented invocations non-interactive.
- `browser-use-connection-adapter`: Allow setup's explicit default choice to select Extension or Direct mode without starting Browser Use.

## Impact

Affected code includes `@panerelay/setup` argument handling, prompts, lifecycle options, Browser Use preference setup, localized messages, and CLI tests. The pinned compatibility baselines remain agent-browser 0.33.0 and Browser Use 0.13.7/Browser Harness 0.1.8. No protocol, Bridge, Extension authorization, target lifecycle, or browser-process ownership behavior changes.

Non-goals: installing upstream engines, changing Browser Use configuration, authorizing tabs, selecting a browser, adding project Provider defaults automatically, or making non-TTY automation commands block on input.
