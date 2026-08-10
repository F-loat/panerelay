## Why

Building the 99 built-in site adapters currently creates a separate TypeScript program and esbuild invocation for every site. One catalog build takes about 65 seconds and 1.7 GB peak RSS, while the root validation path repeats that work up to six times, making routine checks unnecessarily slow and memory-intensive.

## What Changes

- Add a catalog-oriented site-kit build path that validates all selected source adapters in one restricted TypeScript program, bundles them in one esbuild build, validates every generated artifact, and publishes the complete catalog atomically.
- Preserve the existing single-site build behavior for external and setup-managed source adapters.
- Make the built-in site ID list the single source of truth for catalog exports, builds, and tests.
- Emit only the runtime entry point, compiled tests, and installable adapter catalog from `@panerelay/sites`, rather than retaining redundant compiled site source trees.
- Make package build scripts build only their own package and make root validation build the workspace once before running compiled tests.
- Record a reproducible before/after catalog benchmark without committing machine-specific profiles or generated artifacts.
- Non-goals: changing adapter runtime semantics, weakening source/import/type/manifest validation, adding persistent build caching or a new task runner, or changing browser attachment, permissions, tab control, fetch authority, or browser ownership.

## Capabilities

### New Capabilities

- `site-catalog-build`: Defines deterministic, fail-closed, atomic bulk compilation and validation for the lockstep built-in adapter catalog.

### Modified Capabilities

- None.

## Impact

- Affected code: `@panerelay/site-kit` build internals and API, `@panerelay/sites` catalog build and TypeScript configuration, package test scripts, root workspace validation orchestration, and focused build tests.
- Package contents: `@panerelay/sites` continues to expose the same package entry and two-file adapter directories but stops publishing redundant compiled source trees.
- Compatibility: no protocol, CLI, manifest, adapter command, browser, or runtime compatibility change. The pinned agent-browser baseline and every agent-browser compatibility group are unaffected because this change never attaches to or owns a browser and does not alter automation packages.
- Architecture: RFC-0009's source inspection and strict two-file installed format remain authoritative; no RFC amendment is required because the change is build-time only.
