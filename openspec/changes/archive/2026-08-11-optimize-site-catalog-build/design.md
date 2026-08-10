## Context

See `proposal.md` for motivation and `specs/site-catalog-build/spec.md` for the build contract. RFC-0009 remains authoritative for static source inspection, allowed imports, generated runtime behavior, artifact bounds, and the strict two-file installed format.

`@panerelay/sites` currently loops over 99 sources and calls the public single-site builder serially. Every call walks one source graph, creates a fresh TypeScript `Program`, starts a separate esbuild build, validates two files, and replaces one output directory. A measured catalog build takes 65.24 seconds and about 1.7 GB peak RSS. The root `check` path can indirectly invoke that catalog build six times through typecheck, package tests, setup's nested build, and the final workspace build. The package TypeScript configuration also emits all 700 adapter source files even though consumers use only `dist/index.js` and `dist/adapters/*`.

This work is build-time only. It makes no Verified, Forwarded, Partial, or Unsupported browser capability claim and does not change the pinned agent-browser baseline or any compatibility group.

## Goals / Non-Goals

**Goals:**

- Reuse one restricted semantic compilation and one bundler build across the complete built-in catalog.
- Preserve deterministic diagnostics, all current fail-closed validation, and independent single-site tooling.
- Publish only a completely validated catalog and restore the previous catalog if replacement fails.
- Make a root validation run execute the catalog build exactly once.
- Reduce the catalog benchmark toward 15 seconds and 500 MB peak RSS on the baseline development machine without making those machine-specific numbers release gates.

**Non-Goals:**

- Persistent or remote build caches, a new monorepo task runner, watch mode, incremental daemon state, or parallel worker pools.
- Changes to adapter source syntax, command behavior, manifests, browser fetch, setup installation semantics, browser authorization, ownership, or automation engines.
- Removing package-local self-contained test commands used during focused development.

## Decisions

### Add an explicit batch builder without changing the single-site contract

`@panerelay/site-kit` will export a catalog builder that accepts an ordered list of expected IDs and source directories plus one catalog output directory and optional version override. The expected ID is checked against statically extracted site metadata. Input and output paths must be unique and separated, and an empty catalog is rejected.

The existing `inspectSite`, `checkSite`, `testSite`, and `buildSite` APIs retain their behavior. Shared internal phases are extracted so single-site operations still perform their own complete validation. This avoids coupling external adapter authors or setup's local/GitHub source flow to the built-in catalog.

Alternative considered: replace `buildSite` with a one-item catalog call. Rejected because its output target is one installed adapter directory, while the catalog API owns and atomically replaces a parent directory; conflating them would broaden deletion authority and subtly change failure behavior.

### Separate structural inspection from batch semantic checking

Each source graph is still bounded, parsed, import-checked, and metadata-validated independently in input order. The resulting union of production source files is then passed to one TypeScript `Program` using the same strict compiler options and restricted `@panerelay/site-kit` declaration mapping. Diagnostics are accepted only from a selected source root and are rewritten relative to the owning site's root.

Alternative considered: run the existing synchronous per-site checks in `Promise.all` or worker threads. Rejected because promises cannot parallelize synchronous TypeScript work, while workers would multiply the existing high memory use and retain repeated standard-library parsing.

### Bundle virtual per-site entries in one esbuild operation

One esbuild invocation will receive a named entry for every inspected site. A small internal plugin supplies each generated runtime entry with that site's source directory as its resolution root; the existing package-import policy plugin remains active. Code splitting remains disabled so every `<id>/adapter.mjs` is independently executable and self-contained. `write: false` keeps unvalidated results out of the destination. The builder checks that every expected output exists exactly once and obeys the protocol size limit before writing staging files.

Alternative considered: retain one esbuild call per site after only batching TypeScript. That removes the dominant semantic-check cost but leaves avoidable process setup and output bookkeeping. A multi-entry build lets esbuild schedule shared work internally while preserving standalone outputs.

### Stage and replace the complete catalog

The builder creates a mode-restricted staging directory beside the destination, writes each manifest and bundle with user-only permissions, and revalidates every two-file directory. Existing output is replaceable only when absent, empty, or itself composed exclusively of valid ID-matching two-file adapter directories. Publication renames the old catalog to a unique backup and the staging catalog into place on the same filesystem. Failure restores the backup when possible; cleanup removes staging and obsolete backups.

Alternative considered: keep per-site atomic replacement. Rejected because a later invalid site can leave a clean build with a mixed or partial catalog even though each individual directory is valid.

### Use the runtime catalog export as the ID source of truth

The ordered built-in ID tuple remains in `packages/sites/src/index.ts`. The package is compiled before its catalog build script, which imports `builtinSiteIds()` from `dist/index.js` and maps each ID to `src/<id>`. Tests derive full equality from that same export and assert representative canonical IDs and the expected count rather than carrying another 99-item list. The batch builder verifies every directory's declared ID.

Alternative considered: move IDs into JSON consumed by both TypeScript and the build script. Rejected because it adds a package asset and type-narrowing layer without improving authority; the already-public runtime tuple is sufficient after compilation.

### Split package compilation from adapter-source validation

`@panerelay/sites` will use a build TypeScript configuration that emits only `src/index.ts` and its package test into `dist`. Adapter production sources remain inputs to the catalog builder's restricted semantic compilation and adapter tests continue through the site E2E tooling; they are not ordinary package runtime modules. Package `files` will include `dist/index.*` and `dist/adapters` explicitly, excluding compiled tests and redundant source trees from packed output.

Alternative considered: preserve full TypeScript emission and exclude it only through package `files`. Rejected because it still spends compilation time and disk space producing artifacts that no package consumer executes.

### Separate build-dependent tests from compiled test execution

Packages with compiled Node tests will expose `test:compiled` for running already-built test files, while their existing `test` command remains self-contained by building first. Root `check` will run formatting and linting, build the workspace once in topological order, run no-emit package typechecks, then invoke `test:compiled` recursively plus root script tests. Package build scripts will build only their own package; setup will rely on workspace dependency order instead of directly invoking the sites build.

Alternative considered: add Turborepo or a content-addressed cache. Rejected for this change because correcting the dependency graph removes deterministic duplicate work without a new dependency, cache invalidation policy, or CI persistence requirement.

## Risks / Trade-offs

- [One large TypeScript program could surface diagnostics in a different order] → Preserve ordered structural inspection, sort semantic diagnostics by owning catalog entry and source position, and add invalid-source regression tests.
- [One esbuild failure may not identify its site clearly] → Give every virtual entry and output a stable site-qualified name and wrap batch errors with catalog context.
- [Atomic directory replacement can target more data than single-site replacement] → Require a dedicated output outside every source root and validate existing ownership before any rename.
- [Changing workspace scripts can accidentally skip tests] → Inventory all existing test commands, retain package-local `test`, and add a root orchestration test that records one catalog build plus every compiled suite.
- [Removing emitted source trees can break an undeclared deep import] → Treat deep imports as unsupported, validate packed tarball contents, and keep the documented package entry and adapter paths unchanged.
- [Performance varies by machine] → Record command, catalog size, wall time, and peak RSS in a spike report; gate correctness and single invocation, not absolute timing.

## Migration Plan

1. Add batch inspection/build tests and implement the site-kit catalog builder while retaining all single-site tests.
2. Switch `@panerelay/sites` to the authoritative runtime ID list, restricted TypeScript emission, and catalog builder.
3. Add compiled-test commands, remove setup's nested catalog build, and update root validation ordering.
4. Run focused site-kit/sites/setup tests, inspect a packed sites tarball, run the complete repository check, and record the before/after benchmark in `docs/spikes/`.
5. Rollback is a source revert: no user state, installed registry, manifest protocol, or browser configuration migration is involved.
