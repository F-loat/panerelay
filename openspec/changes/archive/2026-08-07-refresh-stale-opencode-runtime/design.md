## Context

See `proposal.md` for the observed stale-runtime failure. On Side Panel initialization, `agent.providers` asks every built-in provider for a descriptor regardless of the current selection. OpenCode discovery currently receives `runtime.json`'s `opencodePath` through the same `configuredPath` input as `PANERELAY_OPENCODE_PATH`, so the first executable ever persisted can permanently outrank the reconstructed setup-time `PATH`. Although the bounded `--version` probe is intended to be side-effect free at the Panerelay contract boundary, the stale executable triggered macOS execution policy while being inspected, before Codex-only preparation could isolate it.

RFC-0001 remains authoritative: provider discovery must not start ACP, preparation failures remain provider-local, the protected reconstructed command environment is the bounded live search surface, and browser authorization is independent of Agent readiness. This change implements its existing statement that rerunning setup refreshes stale entries and live discovery remains authoritative; it does not introduce a new cross-package architecture decision.

The OpenCode 1.18.12 conversation row is Forwarded for both Chrome and Edge in `docs/compatibility/browser-platforms.md`. The stale-path regression uses platform-independent Bridge contracts plus a local macOS repair check; it does not upgrade either browser without dedicated daily-profile Side Panel acceptance.

## Goals / Non-Goals

**Goals:**

- Preserve a deliberately configured OpenCode executable across Native Host restarts and updates.
- Treat an automatically persisted executable as a cache that live PATH discovery can refresh.
- Migrate existing protected runtime files without requiring a destructive reset.
- Keep discovery bounded, version-probed, side-effect free, and provider-local.

**Non-Goals:**

- Do not test ACP initialization for every candidate during provider listing.
- Do not infer executable health from macOS code-signing output or modify Gatekeeper state.
- Do not compare installed versions and choose the numerically newest binary; ordinary PATH order remains authoritative.
- Do not generalize path-origin metadata to Codex, Claude Code, or Qoder in this focused fix.

## Decisions

### Persist the OpenCode path origin beside the selected path

The protected runtime record will carry an optional bounded `opencodePathSource` value with `override` and `discovered` as the only accepted states. Setup writes `override` only when the selected executable is the successful explicit `PANERELAY_OPENCODE_PATH` candidate, or when it preserves a previously recorded override. Every other successful selection is written as `discovered`.

Keeping the origin in protected configuration preserves an explicit pin even though Chrome usually does not inherit the shell variable used during setup. Treating every stored path as a cache was rejected because a later PATH entry would silently defeat a deliberate override. Persisting the entire environment variable was rejected because only the already-bounded executable path is needed.

### Order explicit, live, documented-local, and cached candidates separately

OpenCode candidate resolution will accept an explicit configured path and a distinct persisted fallback path. Candidate order is:

1. an explicit current or protected override;
2. the reconstructed environment's PATH entries;
3. the existing bounded process-local, Windows npm, and documented user-local locations;
4. the automatically persisted fallback.

The resolver continues to deduplicate exact paths and advances only when a candidate is absent, non-executable, or fails the bounded version probe. It does not start ACP. Appending the cache rather than deleting it preserves installations that were discovered earlier but are temporarily absent from the current PATH.

Selecting the highest semantic version was rejected because it would replace normal PATH semantics, require policy for incomparable outputs, and unexpectedly defeat intentional shell ordering. Retrying alternative candidates after an ACP startup failure was rejected for this change because the failing process may already have triggered an operating-system alert or performed provider-owned startup work.

### Treat legacy path records as discovered caches

Existing runtime files have no origin field. They will be interpreted as `discovered`, allowing the first new Bridge setup, self-update, or live provider discovery to prefer a working PATH candidate. This is the only migration that repairs the reported state without asking users to delete protected configuration manually.

An old explicit override cannot be distinguished from old automatic discovery. A user who depended on such an old pin can re-run setup with `PANERELAY_OPENCODE_PATH`; the new record then preserves it explicitly. Treating every legacy path as an override was rejected because it would retain the defect indefinitely.

### Keep operating-system policy and provider preparation unchanged

Panerelay will not inspect, remove, or override quarantine/signature policy. If the selected live candidate passes `--version` but ACP still fails, the existing provider-preparation path reports a retryable provider-specific error and leaves the Extension, browser authorization, and other providers usable.

## Risks / Trade-offs

- [A legacy path was originally an intentional override] → Treat it as discovered once, document the migration, and preserve all newly supplied overrides with explicit origin metadata.
- [The first PATH candidate is older than a cached candidate] → Follow the user's reconstructed PATH order; users who require another binary can set the explicit override.
- [A PATH candidate passes `--version` but fails ACP startup] → Keep the existing contextual preparation failure; do not trigger additional candidate processes or weaken OS policy automatically.
- [Origin metadata is missing, malformed, or manually edited] → Accept only the two known values and fall back to legacy discovered-cache semantics.
- [The persisted fallback no longer exists] → The existing executable and version probes skip it without affecting other providers.

## Migration Plan

1. Read old runtime files without `opencodePathSource` as discovered caches.
2. Let live provider discovery use the new ordering immediately, without rewriting protected state from a read-only provider-list operation.
3. On the next setup or Native Host self-update, write the selected OpenCode path and its validated origin atomically with the existing protected runtime record.
4. Verify the local macOS Chrome Side Panel selects OpenCode 1.18.12 and no longer attempts ACP through the stale 1.2.27 path.
5. Rollback may ignore the optional source field; no OpenCode configuration, credentials, sessions, or browser state require migration.
