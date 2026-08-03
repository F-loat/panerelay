## Context

See `proposal.md` for motivation and `specs/setup-cli-localization/spec.md` for observable behavior. The setup entry point currently owns three readline helpers: free-form integration selection, default confirmation, and uninstall confirmation. Published `@panerelay/setup` currently declares Node.js `>=20`, while workspace development requires Node.js 20.19 or newer.

## Goals / Non-Goals

**Goals:**

- Provide a visible keyboard multiselect with an empty selection allowed.
- Preserve dependency injection so setup flow tests remain deterministic without emulating terminal keypresses.
- Handle Ctrl-C before invoking lifecycle mutations.

**Non-Goals:**

- Change integration installation, default configuration, or doctor behavior.
- Add a full-screen terminal UI or progress animation.
- Change browser ownership or automation capability claims; they remain as currently implemented and are not reclassified by this prompt-only change.

## Decisions

### Use `@clack/prompts` behind setup-owned wrappers

Use Clack's `multiselect`, `confirm`, and `isCancel` primitives. It directly supports an optional multiselect, concise labels and hints, and explicit cancellation. Pin `@clack/prompts` to 1.2.0 because that release exposes the required API without declaring the newer 20.12 patch-level engine floor, preserving the published package's existing Node.js `>=20` contract.

The CLI will expose setup-owned dependency hooks that return integration IDs and booleans. Tests therefore validate Panerelay behavior rather than Clack's rendering internals. Inquirer prompts were considered, but the current packages impose a Node.js 20.17 patch-level floor and require multiple prompt packages or the broader aggregate package.

### Reuse the same confirmation primitive for setup and uninstall

The default wrappers for both yes/no questions will use Clack so readline can be removed. Setup still asks at most one default question, and uninstall remains an independent command with its existing confirmation hook.

### Return a cancellation sentinel to the orchestration boundary

Prompt wrappers normalize Clack's cancellation symbol to `undefined`. The setup path detects that result, prints one localized cancellation message, returns exit code 2, and does not call `setupPanerelay`. This keeps `process.exit` out of library code and makes cancellation testable.

## Risks / Trade-offs

- [Pinned prompt dependency misses later fixes] → Keep the version explicit to preserve the runtime contract; upgrade deliberately when the package engine floor changes.
- [Prompt output differs across terminals] → Assert structured prompt inputs and orchestration behavior in tests instead of ANSI snapshots.
- [Ctrl-C could otherwise leave a partial flow] → Collect both answers before invoking the setup lifecycle.

## Migration Plan

Add the dependency, replace readline prompt adapters, update localization and tests, then run the package and workspace validation suites. Rollback consists of reverting this change; no persisted data migration is involved.
