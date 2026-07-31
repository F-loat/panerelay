## Why

Browser discovery and default-selection commands are ongoing Panerelay administration, not one-time installation work. Keeping them in `@panerelay/setup` makes the runtime control surface look agent-browser-specific and forces recurring users through an installer package, while future automation adapters such as browser-use need the same engine-neutral registry.

## What Changes

- Add a lightweight publishable `@panerelay/cli` package whose `panerelay` binary manages live browser registrations and the saved browser default.
- Move `browsers`, `browser use <selector>`, and `browser clear` from `@panerelay/setup` to the new CLI without changing their deterministic selection or authorization behavior.
- Keep `@panerelay/setup` limited to setup, update, doctor, and uninstall, invoked through `npx` for one-time integration work.
- Support both an optional global CLI installation for recurring use and `npx --yes @panerelay/cli ...` for occasional use; setup does not silently install the CLI globally or modify `PATH`.
- Keep `@panerelay/browser-registry` as the engine-neutral shared runtime library used by the Bridge, CLI, agent-browser 0.33.0 Provider, and future adapters.
- Update lockstep release metadata, package validation, localized help, README guidance, RFC-0006, and compatibility documentation.

Non-goals:

- Do not move browser automation semantics into the CLI or registry.
- Do not make one participant, authorization scope, target inventory, or control lease span browsers.
- Do not change browser-selection precedence, focus behavior, or the agent-browser 0.33.0 compatibility baseline.
- Do not install global npm packages or mutate shell configuration from setup.
- Do not implement a browser-use adapter in this change.

## Capabilities

### New Capabilities

- `panerelay-cli`: Defines the engine-neutral browser administration CLI, its installation modes, localization, and separation from one-time setup.

### Modified Capabilities

- `multi-browser-routing`: Assigns browser inspection and saved-default management to the standalone Panerelay CLI while preserving deterministic routing and browser-local authority.

## Impact

- Adds `packages/cli` and its lockstep npm publication entry.
- Removes browser-management parsing, output, dependencies, and tests from `packages/setup`.
- Reuses `@panerelay/browser-registry` directly without depending on Bridge or an automation engine.
- Updates root and package documentation, release workflow package lists, lockfile metadata, RFC-0006, and OpenSpec main specifications.
