## Context

See `proposal.md` for motivation. The Extension currently reports only Chromium's numeric manifest version, the Host has no queryable embedded release, and setup overwrites one fixed bundle path. The revised product requirement treats version drift as best-effort maintenance after a normal authenticated browser registration, not as a compatibility gate. A usable older Host must remain connected during and after a failed update; only verified replacement success may restart it.

RFC-0001 remains authoritative for Extension identity, authorization, and Bridge policy. RFC-0005 remains authoritative for shared Chrome/Edge hosting and current-user Windows ownership. RFC-0008 records the durable version-maintenance, launcher, lock, and restart decisions and must be revised from its earlier pre-registration-gate wording.

The project still does not preserve protocol compatibility with Hosts predating this change. Existing browser automation classifications and ownership limitations do not change.

## Goals / Non-Goals

**Goals:**

- Complete authenticated browser registration before comparing or updating valid Host releases.
- Request at most one automatic comparison/update per Extension background lifetime.
- Keep the established connection and its normally authorized capabilities usable during a pending update and after any failure.
- Install an exact immutable newer Host release without replacing the executing bundle, then recover the connection through the stable Native Messaging launcher.
- Contain unavailable npm packages and child-process output without adding a publication-time registry polling gate.
- Keep release metadata and Settings version display sourced from the same semantic identity.

**Non-Goals:**

- Automatic downgrade when the Host is newer than the Extension.
- Feature-range negotiation between different releases.
- A resident updater daemon, hosted update service, background polling schedule, rollback UI, or arbitrary package selection.
- Updating optional automation engines, Agent runtimes, Agent Skills, or Panerelay integration selections during base Host maintenance.
- Changing site permission, tab authorization, target identity, debugger attachment, control ownership, or browser-process capability classifications.

## Decisions

### 1. Keep semantic release and Chromium build identity separate

The Extension reads `releaseVersion` from manifest `version_name` and `buildVersion` from numeric manifest `version`. The bundled Host exposes one immutable release constant through bounded `--self-check`. The shared protocol accepts only stable `X.Y.Z` and beta `X.Y.Z-beta.N` semantic releases and keeps the Chromium four-part build diagnostic-only.

Alternative considered: select setup from the Chromium numeric version. Rejected because Chrome ordering metadata is not the npm package identity.

### 2. Register normally, then run one Extension-lifetime maintenance check

`browser.register` carries both version identities and one boolean indicating whether this is the first Host registration initiated by the current Extension background lifetime. The background initializes that boolean to true on startup and consumes it when sending its first registration. Reconnects in the same lifetime still exchange versions but send false, including the reconnect caused by successful Host replacement.

After configured Extension ID and message-shape validation, the Bridge writes normal browser registration, publishes its relay metadata, acknowledges with `hostVersion`, and initializes the existing Agent/integration services. Only then does the Host evaluate maintenance asynchronously. `bridgeConnected` therefore describes Native Messaging plus successful browser registration, not semantic equality.

Alternative considered: gate registration until exact equality. Rejected because the user requires update and package-availability failures not to affect an otherwise working connection.

Alternative considered: run an update on every Native Messaging reconnect. Rejected because a transient disconnect or successful replacement reconnect could create repeated package-runner loops. A new Extension background lifetime intentionally permits one new best-effort attempt.

### 3. Update only an older Host and never downgrade automatically

When the one-shot check finds equality, it does nothing. When the Host is newer, it records no automatic update and keeps the normal connection. Only an older Host retains the validated Extension semantic release as its exact update target.

This preserves the user's explicit no-downgrade decision. Manual rollback remains lockstep: run the older exact setup package and restore the matching Extension deliberately.

### 4. Use one closed exact-version setup runner and contain package absence

The only automatic command is:

```text
npx --yes @panerelay/setup@<validated-newer-extension-release> update --yes
```

No integration flags or Extension-supplied executable, package, path, argument, or shell material is accepted. Timeout and output remain bounded. npm `E404`, `ETARGET`, missing-version, DNS, network, and timeout failures are classified internally from bounded child output, but raw stdout/stderr is never logged or sent to the Extension.

An unavailable exact package is a quiet maintenance failure: the Host stays connected, performs no restart, and does not claim the target was installed. Other setup or verification failures may retain bounded diagnostic state, but they also leave the connection and ordinary capabilities intact. One process does not automatically retry after failure; a future Extension background lifetime or explicit user retry may start a new attempt.

Alternative considered: add release-time polling until the exact npm package resolves. Rejected as unnecessarily heavy; runtime absence is expected to be transient and is safe when the established Host remains usable.

### 5. Install immutable versioned bundles behind a stable launcher

Setup keeps the versioned layout defined by RFC-0008:

```text
~/.panerelay/
├── bin/
│   ├── panerelay-native-host.cjs
│   └── panerelay-native-host.cmd
├── hosts/<release>/native-host.bundle.cjs
├── host-current.json
├── runtime.json
└── update.lock
```

It stages the target, runs its bounded self-check, validates protected file shape and identity, refreshes managed base artifacts, and atomically commits the version pointer last. The executing old bundle and prior pointer remain launchable on every pre-commit failure. Normal cleanup retains current and previous versions.

### 6. Serialize Chrome and Edge with one protected target-aware lock

Each browser may launch a separate Host process. Setup uses one current-user atomic lock record containing only PID, start time, and validated target release. Waiters use bounded polling. Stale recovery requires both expired age and a dead PID and removes only an inode/content-matched lock. Malformed or live locks fail without deletion.

Both browser connections may remain usable while their setup attempts serialize. A Host that sees its target already committed skips duplicate replacement and proceeds to success-only restart.

### 7. Restart only after verified success and preserve reconnect state

After setup returns successfully or the exact target pointer is already committed, the old Host sends restart-pending, closes Agent/relay services and owned browser-registration state, then exits. The Extension preserves authorization selection and reconnect feedback across this expected disconnect. Its existing reconnect path launches the stable entry, registers normally, and does not request another automatic update in the same background lifetime.

Failure never calls the restart path. The old Host, browser registration, provider access, integrations, and authorized automation remain governed by their existing gates.

### 8. Keep maintenance presentation secondary to connection and authority

Settings uses the shared manifest helper to show muted `v<version_name>` beside the localized title even when no Host is connected. Pending or failed maintenance does not replace the connected conversation interface, disable available actions, render the missing-Host guide, or clear authorization. Restart-pending may temporarily show reconnect feedback.

Package-unavailable failure is intentionally quiet: no npm output or blocking failure surface is required. A newer Host may be shown diagnostically but never as a request to downgrade.

### 9. Keep release validation lightweight

Candidate validation checks Extension `version_name`, embedded Host self-check, Bridge/setup package versions, and inventory identity. Existing packed smoke continues ordinary setup, launcher, doctor, update, and uninstall coverage. It does not synthesize registry availability, an older-package download, or post-publication polling.

Compatibility remains `Partial` where real daily Chrome or Windows Chrome/Edge evidence is not retained. Self-update transport alone changes none of the agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, Playwright CLI 0.1.17, Chrome, or Edge classifications.

## Risks / Trade-offs

- **[A valid older Host may not fully understand a newer Extension]** → This early-project policy deliberately favors connection continuity; the protocol itself still changes atomically and malformed messages fail validation.
- **[The exact npm package is absent or the machine is offline]** → Contain bounded child failure, keep the old connection, expose no raw output, and allow a later Extension background lifetime to try once again.
- **[A successful update disconnects active work]** → Restart only after verified commit, flush restart-pending first, clean up owned services, and reuse the Extension's bounded reconnect path.
- **[Transient reconnects could create update loops]** → Consume one in-memory update-check trigger per Extension background lifetime; the success reconnect sends no second trigger.
- **[Concurrent Chrome and Edge processes race]** → Serialize setup with the protected target-aware lock and observe the committed pointer before duplicate work.
- **[The stable launcher becomes a long-lived surface]** → Keep it path-closed and minimal; require an explicit future migration for contract changes.
- **[Update status could be mistaken for authority]** → Keep maintenance state separate from connection, authorization, targets, and control leases.

## Migration Plan

1. Revise RFC-0008 and its RFC-0001/RFC-0005 references from pre-registration gating to post-registration best-effort maintenance.
2. Add the one-shot registration trigger and normal-first registration semantics across protocol, Host, registry, and Extension state in one change.
3. Retain the stable launcher, staged bundle, pointer, lock, doctor, uninstall, and failure-recovery implementation.
4. Classify package-unavailable/network/timeout outcomes without exposing child output; ensure every failure keeps the connection alive.
5. Make Side Panel maintenance presentation non-blocking while retaining the Settings release label.
6. Run focused protocol, Bridge, setup, Extension, release-identity, and managed-installation tests, then retain real-browser/platform evidence only where available.

Rollback remains manual and lockstep. Panerelay never automatically downgrades a newer Host.
