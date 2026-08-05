## Context

RFC-0001 assigns agent process ownership, lifecycle, and provider-neutral event normalization to the Bridge. The current Provider modules depend on Bridge-owned host facilities such as runtime configuration, platform and executable discovery, agent context, browser guidance, and conversation images. They are also compiled and bundled into the Bridge native host rather than released as standalone artifacts.

The repository now uses `packages/adapters/` for independently publishable browser automation Adapter packages. Agent Providers are a separate concept, but that distinction does not imply an equivalent workspace-package boundary.

## Goals / Non-Goals

**Goals:**

- Make Provider ownership visible inside the Bridge source tree.
- Group runtime-specific implementation and tests without changing behavior.
- Preserve deterministic compilation, bundling, packaging, and release validation.

**Non-Goals:**

- Do not define a new public Provider SDK or package interface.
- Do not extract Bridge host capabilities merely to enable independent packages.
- Do not change accepted cross-package architecture or provider compatibility claims.

## Decisions

### Keep Providers internal to the Bridge

Provider implementations remain in `packages/bridge` because they consume Bridge host facilities and are instantiated only by the Bridge's `AgentService`. Extracting them into workspace packages now would require a new host-facing API, introduce package dependency edges, and expand the release surface without a product need.

### Organize by runtime under `src/providers/`

The shared contract moves to `providers/contract.ts`. Codex and Claude Code receive dedicated directories. Qoder and OpenCode retain small runtime-specific wrappers while sharing the generic ACP implementation in `providers/acp/`:

```text
providers/
  contract.ts
  codex/{provider,app-server}.ts
  claude-code/{provider,cli,permission-server}.ts
  acp/{provider,context}.ts
  qoder/{provider,executable}.ts
  opencode/{provider,executable}.ts
```

Tests remain next to the modules they cover. Bridge host modules stay at `src/` so `providers/` expresses runtime integration ownership rather than becoming a second Bridge core.

Current RFC wording will use Agent Provider for Codex, Qoder, Claude Code, and OpenCode integrations, reserving Automation Adapter for browser automation integrations. This clarifies terminology without changing the accepted Bridge ownership or protocol decisions.

### Accept nested compiled paths

TypeScript will mirror the source tree under `dist/providers/`. Deterministic release artifact inventories will assert the nested paths. Compatibility shims at the former internal paths are rejected because no public export promises those files and duplicate output would obscure stale imports.

## Risks / Trade-offs

- [Relative imports can accidentally cross the wrong number of directory levels] → Move tests with implementations, update all imports explicitly, and run Bridge typechecks and tests.
- [Release validation may still expect former flat `dist` files] → Update deterministic Bridge artifact entries and run the complete release candidate check.
- [The directory name could imply independent package boundaries] → Document that Providers remain Bridge-internal and avoid adding workspace manifests or public exports.
- [Generated output can retain obsolete flat files] → Use the existing Bridge clean/build flow and search source, scripts, and resulting `dist` for stale paths.

## Migration Plan

1. Move the shared contract, Provider implementations, executable helpers, permission server, ACP context, and colocated tests under `src/providers/`.
2. Update Bridge root consumers, cross-Provider imports, and release artifact inventories.
3. Clean and rebuild the Bridge, then verify focused tests and packed release artifacts.
4. Run the full repository check, OpenSpec validation, and diff checks.

Rollback is a source-only reversal of the moves and path edits; no published package, persisted state, or user data migration is involved.
