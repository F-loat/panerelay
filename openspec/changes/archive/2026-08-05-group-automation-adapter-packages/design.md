## Context

See [proposal.md](./proposal.md) for motivation. The packages are independently published and imported by package name, but the workspace, package metadata, setup private bundling, release allowlists, local development configuration, and documentation also refer to their physical directories. RFC-0001 remains authoritative for the Automation Adapter and Agent Provider distinction and for package separation. RFC-0007 remains authoritative for the Browser Use and Playwright connection boundaries.

## Goals / Non-Goals

**Goals:**

- Make `packages/adapters/` the repository home for browser automation Adapter packages.
- Preserve deterministic workspace, build, test, setup, release, and documentation behavior after the move.
- Keep public package identities and compatibility evidence unchanged.

**Non-Goals:**

- Do not create a runtime adapter registry, shared base package, or new dependency edge.
- Do not reorganize core packages or Agent Provider implementations.
- Do not revise browser capability classifications or claim new compatibility evidence.

## Decisions

### Use one `packages/adapters/<name>` level

The three packages move to `packages/adapters/agent-browser`, `packages/adapters/browser-use`, and `packages/adapters/playwright`. The concise `adapters` group follows the established Automation Adapter terminology. Deeper `adapters/automation/<name>` nesting is unnecessary while Agent Providers remain a separate concept and implementation area.

### Preserve package names and explicit package inventories

All `@panerelay/*` names, exports, binaries, and package-name dependency edges remain unchanged. Release and CI allowlists will be updated to the new directories rather than replaced with filesystem auto-discovery, preserving the repository's deterministic publish boundary.

### Use explicit pnpm workspace globs

The workspace will retain `packages/*` for core packages and add `packages/adapters/*` for the grouped packages. A broad recursive `packages/**` glob is rejected because it could unintentionally treat future fixtures or nested support directories as workspace packages.

### Update current repository documentation, not historical change records

Current README links, package guides, RFC-0001's repository tree, release documentation, compatibility links, and reproducible spike instructions will point to the new paths. Archived OpenSpec changes remain historical records of the layout in which they were implemented. No RFC behavior or status changes.

## Risks / Trade-offs

- [A stale relative path can pass package-name typechecks but break setup packaging or release preparation] → Update setup entry points and explicit release allowlists, then run setup builds, release checks, packed-artifact tests, and the full repository check.
- [Nested paths change TypeScript, test-runner, and README relative depth] → Search for both literal old directories and root-relative assumptions inside the moved packages after migration.
- [The lockfile can retain obsolete importer paths] → Regenerate it with pnpm and verify a frozen install accepts the result.
- [Directory grouping could be mistaken for a merged runtime boundary] → Keep three manifests, public names, compatibility records, and release entries independent.

## Migration Plan

1. Move the three tracked package trees into `packages/adapters/`.
2. Update workspace discovery and every build-, setup-, release-, metadata-, local-development-, and documentation-sensitive path.
3. Regenerate the pnpm lockfile and confirm old live paths are absent outside historical OpenSpec records.
4. Run package-focused builds/tests, release checks, the full repository check, a frozen install, and `git diff --check`.

Rollback is a source-only reversal of the moves and path edits; no published package or user data migration is involved.
