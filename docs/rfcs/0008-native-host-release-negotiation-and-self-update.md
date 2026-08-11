# RFC-0008: Native Host release negotiation and self-update

- RFC: 0008
- Title: Native Host release negotiation and self-update
- Status: Accepted
- Authors: F-loat
- Created: 2026-08-05
- Updated: 2026-08-11
- OpenSpec: `openspec/changes/add-native-host-self-update`, `openspec/changes/refine-fetch-onboarding`

## Summary

The authenticated Extension reports its semantic manifest `version_name` separately from Chromium's numeric build `version`; the running Native Host reports a release embedded in its bundle. After validating Extension identity and registration shape, the Host completes ordinary browser registration regardless of whether the two valid semantic releases match. Version maintenance is best-effort background work and is not a connection prerequisite.

An older Host automatically invokes one fixed, exact-version, non-interactive `@panerelay/setup` operation. Normal Setup also provides the recurring `panerelay` command: it installs a missing exact-version global CLI, records protected ownership, and updates only an unchanged Setup-owned installation. A pre-existing, externally changed, or PATH-visible alternate-Node-prefix global CLI is preserved. Setup then stages an immutable versioned Host bundle behind a stable user-scoped launcher, validates the staged bundle, atomically switches a protected current-version pointer, and leaves the running old bundle untouched. The old Host exits so Chrome or Edge reconnects through the launcher to the installed release. A newer Host never automatically downgrades.

Only the first registration initiated by an Extension background lifetime requests automatic comparison. Update state remains distinct from Native Messaging transport connectivity, completed browser registration, browser authorization, and control ownership. A valid older or newer Host remains usable through the ordinary gates understood by that connection; a newer Host is never automatically downgraded.

## Relationship to existing RFCs

- RFC-0001 remains authoritative for the Bridge trust boundary, Extension identity, fixed-command policy, Agent providers, browser authorization, and Native Messaging transport.
- RFC-0004 remains authoritative for observed versus controlled targets, visible user release, and revocation.
- RFC-0005 remains authoritative for shared Chrome/Edge Extension hosting and current-user Native Messaging discovery.
- RFC-0006 remains authoritative for registration selection after a browser has completed ordinary registration.
- RFC-0007 remains authoritative for Browser Use and Playwright bootstrap participants after registration.

This RFC supersedes RFC-0005's same-protocol compatibility exception for missing optional registration metadata. The new protocol and launcher contract intentionally do not migrate or accept pre-RFC-0008 Hosts. It does not supersede any permission, authorization, target, control, routing, or browser-process ownership decision.

## Goals and non-goals

### Goals

1. Compare releases once after normal registration without making update availability a connection gate.
2. Update only to the authenticated Extension's exact immutable semantic release.
3. Preserve one launchable user-scoped Host installation across interruption and concurrent Chrome/Edge launches.
4. Keep package selection closed and independent of optional automation integrations.
5. Expose only bounded, non-blocking maintenance and restart state to the Side Panel.
6. Keep release/update state separate from site permission, tab authorization, and automation control.
7. Keep a Setup-created global Panerelay CLI on the same exact release without taking over user-managed global package state.

### Non-goals

1. Support a feature range or mixed-release compatibility negotiation.
2. Migrate a Host installed before this RFC's launcher and protocol contract.
3. Add a background updater, hosted update service, dist-tag selection, arbitrary package execution, or automatic rollback UI.
4. Install, update, downgrade, or remove agent-browser, Browser Use, Playwright CLI, Agent Skills, or Agent runtimes.
5. Change CDP behavior, browser-process ownership, unsupported browser features, authorization, or control leases.

## Terminology

- **Release version**: Panerelay's stable `X.Y.Z` or beta `X.Y.Z-beta.N` semantic identity.
- **Build version**: Chromium's numeric four-component Extension `version`, used for browser update ordering only.
- **Stable launcher**: the user-scoped Native Messaging executable path that selects a validated versioned Host bundle.
- **Current pointer**: protected installation metadata containing one release version from which the launcher derives the bundle path.
- **Registered connection**: a Native Messaging transport whose browser registration was validated, committed, and acknowledged, independent of semantic release equality.
- **Update owner**: the one current-user Host process holding the protected cross-process lock for a target release.

## Architecture

```text
Chrome or Edge Extension
        │ browser.register
        │ releaseVersion + buildVersion + checkHostUpdate
        ▼
running Native Host
        │ validate Extension ID
        │ complete registration and acknowledge Host release
        │
        ├── check=false ─────────▶ normal connected operation
        │
        │ compare embedded release in background
        ├──────── equal ─────────▶ no maintenance
        │
        ├──────── older ─────────▶ exact setup update
        │                              │
        │                         staged bundle
        │                         self-check
        │                         atomic pointer
        │                              │
        │                         old Host exits
        │                              ▼
        │                         browser reconnects
        │
        └──────── newer ─────────▶ normal connection, no downgrade
```

BrowserRelay publishes the validated browser, writes its live registration, acknowledges the running Host release, and emits its activity snapshot before invoking version maintenance. The first Extension registration in one background lifetime sets `checkHostUpdate=true`; all reconnect registrations from the same background set it to `false`.

## Release identity

The Extension uses one shared manifest-identity helper for registration and Settings presentation:

```text
releaseVersion = manifest.version_name
buildVersion   = manifest.version
```

The Bridge build injects the exact package version into the Host bundle. The Host exposes a bounded `--self-check` mode that returns release and protocol metadata without starting the relay, local gateways, Agent providers, or Native Messaging loop.

Panerelay accepts only its published stable and beta syntax. Parsing rejects four-component Chrome versions, leading-zero variants, npm tags, ranges, paths, shell material, and unsupported prerelease shapes. The numeric build version never selects a package.

## Registration and update protocol

The protocol advances with this breaking change. A successful `browser.registered` includes the running Host release and means ordinary browser registration is complete. It does not assert release equality. Version lifecycle retains a dedicated bounded message with these states:

- `required`: the authenticated Extension is newer;
- `updating`: the exact setup operation is running or waiting on the user-scoped update owner;
- `restart-pending`: the target pointer is committed and the old process will exit;
- `failed`: the attempt settled without committing the target and may be explicitly retried;
- `incompatible`: reserved for bounded protocol diagnostics, not automatic downgrade; and
- `ready`: local maintenance is not blocking the registered connection.

The retry request carries no version, package, executable, path, or arguments. It retries only the validated target retained by that connection. A process makes one automatic attempt. Exact-package unavailability is quiet: no raw npm output, blocking failure surface, restart, or reconnect occurs. Other failures may expose a sanitized retry category but do not disable the connection.

The Extension keeps transport, completed registration, and maintenance state separate. `bridgeConnected` means the Native Messaging transport is connected and browser registration completed. Pending or failed maintenance does not disable Provider discovery, integration requests, CDP publication, target attachment, or control acquisition beyond their existing authorization and ownership gates. Restart-pending alone may show reconnect progress after a verified successful replacement.

## Fixed setup execution

For an authenticated older Host, the Bridge maps the validated target release to exactly:

```text
npx --yes @panerelay/setup@<release> update --yes
```

The mapping accepts no Extension-provided package name, command, flag, path, or shell fragment. It uses structured process arguments, a bounded timeout, safe Windows command-wrapper handling, and bounded captured output that never crosses Native Messaging. Missing exact packages are contained quietly; other failures may return a stable sanitized category and exact manual command.

No integration flags are supplied. Before Host mutation, base Setup detects npm's global `@panerelay/cli` and any PATH-visible `panerelay` command outside a project-local `node_modules/.bin`. If both are absent, Setup installs the exact Setup release and writes a protected ownership record. If the installed version still matches that record, update skips a matching release or advances it to the exact target. A global installation without a matching ownership record, including one exposed by another NVM, Volta, or npm prefix, is reported and preserved rather than reinstalled, downgraded, or claimed. Adapter `add`, `remove`, and `adapters` operations never run this lifecycle. `--no-cli` is the explicit escape hatch for setup/update, while uninstall removes only an unchanged Setup-owned CLI unless `--keep-cli` is supplied.

The npm operation uses a resolved executable and structured arguments without a shell, captures bounded output that is not echoed on failure, and completes before Native Host mutation. Setup does not edit shell startup files; the npm global prefix remains user-configured. Base update otherwise preserves the effective Extension ID, runtime path entries, optional Panerelay Provider/adapter registrations, defaults, and unrelated user configuration. It does not probe or modify upstream automation engines, Agent Skills, or Agent runtimes.

## Stable launcher and installation transaction

Setup installs a stable launcher and immutable release directories under user-owned Panerelay state:

```text
~/.panerelay/
├── bin/
│   ├── panerelay-native-host.cjs
│   ├── panerelay-native-host.cmd
│   └── panerelay-native-launcher.cjs
├── hosts/<release>/native-host.bundle.cjs
├── host-current.json
├── runtime.json
└── update.lock
```

POSIX manifests point to the stable executable launcher. Windows Chrome and Edge registry values continue to point to one shared manifest whose path names the stable `.cmd` entry. The launcher reads only one protected semantic version, derives the bundle location beneath the fixed hosts directory, rejects unsafe file types or traversal, and spawns the bundle with inherited Native Messaging stdio.

Setup writes a staged version directory, validates ownership and file shape, runs `--self-check`, and verifies the expected release/protocol before atomically replacing the current pointer. The executing old bundle and current pointer remain untouched until commit. The previous bundle is retained for diagnostics and manual lockstep rollback; older unused bundles may be pruned only after a later successful commit.

The stable launcher is a durable compatibility surface. A future change that cannot be expressed behind this launcher requires an explicit migration RFC rather than silently replacing its contract.

## Cross-process update ownership

Chrome and Edge can launch separate Host processes concurrently. A protected target-aware lock serializes setup across the current user. Its record contains only a validated target release, owner PID, and bounded start time; it is never an execution source.

The owner performs setup and releases the lock. Waiters reread the protected current pointer:

- a matching target causes restart-pending and exit without duplicate setup;
- an unchanged older pointer after owner failure leaves each registered old Host usable and allows only its already-requested bounded attempt to settle; and
- malformed or expired wait state fails closed.

Stale cleanup requires both a bounded expired age and a non-live PID, and removes only the exact Panerelay lock. Doctor reports inconsistent launcher, pointer, bundle, lock, manifest, or Windows registry state without starting an update.

## Security and privacy

1. Expected Extension identity is validated before version comparison or process launch.
2. Only a strict semantic release chooses one fixed `@panerelay/setup` package.
3. Extension messages never supply executable or command material.
4. Update output, registry data, paths, provider configuration, page content, cookies, credentials, prompts, screenshots, and request bodies do not cross the update status protocol or enter logs by default.
5. Version mismatch itself neither grants authority nor blocks normal registration; every Provider, integration, target, attachment, and control operation remains subject to its existing validation and authorization gates.
6. Update state never grants, widens, revokes, or exercises site permission or tab authorization.
7. Stable launcher and current pointer remain user-scoped and reject unsafe file ownership, type, or derived paths.
8. Automatic downgrade is forbidden.
9. Global CLI lifecycle uses only the fixed `@panerelay/cli` package at the validated Setup release; ownership records never become package, executable, or argument input.

## Compatibility and migration

This RFC deliberately introduces a clean break. Development and candidate installations must run the matching new setup once to install the stable launcher layout. A pre-RFC-0008 Host is not expected to interpret the new registration protocol or update itself.

Stable and beta release validation checks the Extension identity, embedded Host self-check, package versions, and candidate inventory without polling npm after publication or synthesizing an old-package download. If an unpacked or newly published Extension names a package that is not yet resolvable, the automatic attempt fails quietly and the existing Host connection remains usable. It never falls back to `latest` or `beta`.

Rollback is manual: install the intended earlier package explicitly if desired. A Setup-owned CLI follows that explicit Setup release; a user-owned CLI remains untouched. A newer Host remains normally connected and does not automatically downgrade itself for an older Extension.

Self-update remains `Partial` until deterministic packed-consumer coverage passes on macOS, Linux, and Windows and representative daily Chrome plus real Windows Chrome/Edge evidence is retained. Passing update transport does not change agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, Playwright CLI 0.1.17, Edge automation, or browser-process capability classifications.

The bounded source fixture in `docs/spikes/0006-native-host-stable-launcher-reference.md` verifies Node stdio inheritance, Native Messaging framing, semantic pointer selection, paths containing spaces, preservation of running old bundles, and new-process selection. It does not replace the required real Windows `.cmd`, HKCU, Chrome, Edge, locking, and filesystem evidence, which remains `Partial`.

## Alternatives considered

### Side Panel selects and runs the update

Rejected because presentation code cannot attest the running Host bundle and must not own local package execution policy.

### Overwrite the executing Host path

Rejected because interruption can truncate the next Native Messaging launch target and in-use Windows file behavior is not a sufficient cross-platform transaction.

### Point every browser manifest at a version-specific bundle

Rejected because concurrent browsers could observe partially updated manifest or registry ownership. One stable launcher and atomic pointer provide a single commit point.

### Use `latest`, `beta`, or a compatible range

Rejected because a tag or range can resolve differently from the immutable Extension release.

### Block normal registration until releases match

Rejected for the current project phase because package publication, network availability, or a failed local replacement would turn otherwise usable Host capabilities into a connection outage. Registration continuity is deliberately preferred; protocol validation, permissions, authorization, and control leases still fail closed on their own boundaries.

## Delivery and acceptance

The linked OpenSpec change owns implementation tasks and tests. Acceptance requires:

1. adversarial release parsing and protocol guards;
2. deterministic launcher, self-check, staged commit, failure injection, locking, doctor, and uninstall tests;
3. matching/older/newer/offline/retry/restart Host integration coverage proving registration precedes maintenance and failure retains the connection;
4. Side Panel stable/beta version, non-blocking maintenance, and restart recovery coverage;
5. stable/beta release identity and lightweight candidate identity gates;
6. packed-consumer setup/update/doctor/uninstall on macOS, Linux, and Windows;
7. a retained daily Chrome update/reconnect result; and
8. real current-user Windows Chrome/Edge evidence from paths containing spaces.
9. global CLI absent/current/owned-update/user-owned-preservation/uninstall coverage using structured npm invocation on macOS, Linux, and Windows path semantics.

This RFC remains Accepted until the governed release and its applicable compatibility evidence are published. It must not move to Implemented merely because local tests pass.
