## Context

The multi-browser implementation currently places recurring `browsers`, `browser use`, and `browser clear` commands in `@panerelay/setup`. The commands already delegate storage and selection to `@panerelay/browser-registry`, but the package boundary suggests that setup is a persistent product CLI and couples future documentation to the agent-browser installation flow. See `proposal.md` and the capability deltas for the desired behavior.

`@panerelay/setup` remains the one-time installer and diagnostic entry point. `@panerelay/browser-registry` is already a small Node.js library shared by independently running Native Hosts and the agent-browser 0.33.0 Provider. RFC-0006 remains authoritative for deterministic selection, participant pinning, browser-local ownership, and fail-closed behavior.

## Goals / Non-Goals

**Goals:**

- Give recurring browser administration an engine-neutral package and executable.
- Keep one implementation of registry validation, selection precedence, and protected default storage.
- Preserve localized global and one-shot command behavior.
- Keep every publishable package on the lockstep stable/beta release path.
- Make setup's command surface visibly installation-scoped.

**Non-Goals:**

- Add browser automation commands or an adapter SDK to the CLI.
- Auto-install a global npm package or mutate shell configuration.
- Change registry files, protocol messages, selection precedence, permissions, leases, or compatibility classifications.
- Add a browser-use implementation or change the agent-browser 0.33.0 Provider contract.

## Decisions

### Publish `@panerelay/cli` with the `panerelay` bin

The new package will contain only browser-administration parsing, localization, presentation, and calls into `@panerelay/browser-registry`. Its runtime dependencies will be the registry and its transitive protocol dependency; it will not depend on Bridge, setup, agent-browser, or an Agent provider.

A global npm installation provides `panerelay ...` for frequent use. npm's package-scoped execution provides `npx --yes @panerelay/cli ...` for occasional use. Setup will document these choices but will not install either mode automatically.

Alternatives:

- Keeping commands in setup preserves fewer packages but conflates recurring control with installation.
- agent-browser custom plugin commands avoid another executable but bind the Panerelay management plane to one automation engine.
- Bundling the CLI into setup and copying it to a user bin directory creates cross-platform `PATH` and update ownership problems.

### Keep the browser registry as the shared runtime boundary

Bridge, Provider adapters, and the CLI will use `@panerelay/browser-registry` directly. This avoids placing filesystem, process-liveness, credential-file, and browser-selection behavior in the provider-neutral protocol package. It also avoids making future adapters depend on either the CLI or agent-browser.

The registry remains an internal shared library despite being published as a lockstep transitive npm dependency. It has no command, UI, page access, or automation semantics.

### Remove recurring commands from setup without a compatibility shim

The browser commands were introduced only on the current unreleased multi-browser branch. The setup parser, help, localized strings, and command tests will remove them rather than keeping aliases that prolong the wrong package boundary.

Doctor retains registry inspection because connection diagnosis is installation health, not browser-default administration.

### Reuse behavior tests at the new boundary

Browser command parser and behavior tests move to `@panerelay/cli`. Setup tests add negative coverage showing that recurring commands are no longer accepted. Registry tests continue to own deterministic selection and protected storage. Release tests and workflows include the CLI package in dependency order and packed-content validation.

## Risks / Trade-offs

- [Users may assume setup installs the optional CLI] → Documentation separates one-time setup from optional recurring administration and always shows the `npx @panerelay/cli` fallback.
- [Two npm packages expose a bin named `panerelay`] → Official guidance never globally installs `@panerelay/setup`; package-scoped `npx @panerelay/setup` resolves its temporary bin, while the global name belongs to `@panerelay/cli`.
- [CLI and runtime versions can drift] → Publish CLI, registry, Bridge, adapters, setup, and Extension in the existing lockstep stable/beta release process.
- [Another automation engine needs different selection inputs] → Keep selection and default state in the registry; adapters translate their own invocation surface without changing the CLI.

## Migration Plan

1. Add and validate the new package with the existing browser-command tests.
2. Remove browser operations and messages from setup while retaining doctor registry diagnostics.
3. Add the CLI to lockstep build, publish, release-preflight, integrity, and license checks.
4. Update README, package guidance, installed Agent Skill, RFC-0006, and compatibility documentation.
5. Verify both the built direct binary and `npx`-equivalent package entry against isolated registry fixtures, then run full repository validation.

Rollback removes `@panerelay/cli` from the candidate and restores the unreleased setup command implementation. Registry state and browser processes require no migration.
