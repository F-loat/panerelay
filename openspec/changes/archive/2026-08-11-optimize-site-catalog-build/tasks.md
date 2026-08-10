## 1. Batch site-toolkit build

- [x] 1.1 Add focused fixtures and tests for ordered batch source inspection, duplicate/mismatched IDs, shared restricted typechecking, and deterministic site-qualified diagnostics.
- [x] 1.2 Refactor source inspection so single-site operations keep complete validation while catalog inputs share one restricted TypeScript program.
- [x] 1.3 Add one multi-entry esbuild catalog operation with exact output mapping, artifact bounds, and public result types while preserving the existing single-site API.
- [x] 1.4 Add focused tests for exact two-file outputs, existing-output ownership checks, all-or-nothing failure, atomic replacement, rollback, and staging cleanup.

## 2. Built-in catalog package

- [x] 2.1 Switch the sites build script to `builtinSiteIds()` plus the batch catalog builder and verify every declared source ID matches its catalog entry.
- [x] 2.2 Restrict sites TypeScript emission to the package entry and compiled package tests while retaining adapter source validation through the catalog operation.
- [x] 2.3 Update catalog coverage and package-content tests so the authoritative IDs, exported paths, built directories, and packed two-file artifacts match exactly without redundant site source trees.

## 3. Workspace orchestration

- [x] 3.1 Inventory compiled package test runners and add `test:compiled` scripts while keeping package-local `test` commands self-contained.
- [x] 3.2 Remove setup's direct sites build invocation and reorder root validation to build the workspace once before no-emit typechecks and compiled tests.
- [x] 3.3 Add or update script-level regression coverage proving root validation invokes the catalog once without skipping package or root tests.

## 4. Verification and evidence

- [x] 4.1 Run frozen dependency installation, focused site-kit/sites/setup tests, catalog artifact validation, and packed-package inspection.
- [x] 4.2 Re-run the catalog wall-time and peak-RSS benchmark, document the reproducible before/after result in `docs/spikes/`, and remove generated profiles, tarballs, logs, and staging artifacts.
- [x] 4.3 Run strict OpenSpec validation, the complete repository check, and `git diff --check`; confirm in the report that daily-Chrome and compatibility-matrix verification are not applicable because no browser/runtime capability changed.
