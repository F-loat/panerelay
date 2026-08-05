## 1. Group Adapter Packages

- [x] 1.1 Move the agent-browser, Browser Use, and Playwright package trees into `packages/adapters/` while preserving their manifests, public names, exports, and binaries.
- [x] 1.2 Update pnpm workspace discovery, TypeScript base-config depth, shared test-runner paths, package repository metadata, and local agent-browser development configuration.
- [x] 1.3 Update setup's private adapter bundling and verify the bundled Browser Use and Playwright entry points resolve from their new locations.

## 2. Update Release and Documentation Paths

- [x] 2.1 Update deterministic release inventories, release tests, preparation CI allowlists, and the pnpm lockfile for the new adapter directories.
- [x] 2.2 Update current README, website, package-guide, RFC, compatibility, spike, and marketing references while leaving archived OpenSpec history unchanged.
- [x] 2.3 Search for stale live references and remove obsolete top-level adapter package directories or generated output left by the move.

## 3. Verify the Refactor

- [x] 3.1 Run focused adapter and setup builds/tests plus release checks that exercise source bundling and packed package inventories.
- [x] 3.2 Run a frozen pnpm install, the full repository check, OpenSpec validation, and `git diff --check`.
- [x] 3.3 Review compatibility records and the final diff; retain existing Verified, Forwarded, Partial, and Unsupported classifications and document that daily-Chrome verification is not required because no browser behavior or compatibility claim changes.
