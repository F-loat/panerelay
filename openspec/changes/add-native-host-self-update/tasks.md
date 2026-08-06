## 1. Architecture and Compatibility Evidence

- [x] 1.1 Revise RFC-0008 and its RFC-0001/RFC-0005 references so valid version drift is post-registration best-effort maintenance, older Hosts update without blocking connection, newer Hosts never auto-downgrade, and only successful replacement restarts.
- [x] 1.2 Build a bounded Windows spike with source fixtures that verifies a stable Node launcher can select a versioned Host bundle, preserve Native Messaging stdio, handle paths containing spaces, keep the running old bundle intact, and reconnect Chrome and Edge after a pointer switch.
- [x] 1.3 Record the stable-launcher spike under `docs/spikes/` and keep unverified real-platform claims classified as Partial.

## 2. Release Identity and Protocol

- [x] 2.1 Add a strict shared Panerelay release parser/comparator for stable `X.Y.Z` and beta `X.Y.Z-beta.N`, rejecting Chromium builds, tags, paths, leading zeros, unsupported prereleases, and command-like input.
- [x] 2.2 Inject the exact Bridge package release into the bundled Native Host and add bounded `--self-check` output that starts no Host services.
- [x] 2.3 Extend registration with required Extension semantic release, Chromium build metadata, Host semantic release acknowledgement, and one bounded boolean that requests the first update check of an Extension background lifetime.
- [x] 2.4 Keep Host update status/retry schemas bounded and free of Extension-supplied package, executable, path, command, or argument material.

## 3. Stable Launcher and Managed Installation

- [x] 3.1 Resolve stable launcher, versioned Host directory, protected pointer, previous-version retention, and user-scoped update-lock paths.
- [x] 3.2 Implement POSIX and Windows stable launchers that validate one semantic pointer, derive only the fixed bundle path, reject unsafe state, and proxy Native Messaging stdio and exit status.
- [x] 3.3 Stage a versioned Host bundle, run bounded self-check, validate its identity, and atomically commit the current-version pointer only after every managed artifact succeeds.
- [x] 3.4 Preserve custom Extension identity, runtime path entries, optional integration selections, manifests, and Chrome/Edge HKCU ownership across an unflagged Host update.
- [x] 3.5 Serialize Chrome/Edge setup with protected target-aware locking, bounded waiting, safe stale-owner detection, and exact-path cleanup.
- [x] 3.6 Diagnose launcher, pointer, selected bundle, embedded release, lock, manifest, and Windows registry agreement without executing an update.
- [x] 3.7 Remove the managed versioned layout idempotently on uninstall and retain only current/previous bundles after success without touching unrelated files or keys.
- [x] 3.8 Cover staging, self-check, launcher, pointer, registry, and lock failures with injection tests that preserve one committed launchable Host.

## 4. Non-Blocking Host Update Coordination

- [x] 4.1 Classify exact-package absence, network failure, timeout, and setup failure from bounded `npx --yes @panerelay/setup@<release> update --yes` execution without logging or exposing child output.
- [x] 4.2 Complete expected-Extension-ID validation, browser registration, registry publication, and normal service initialization before asynchronously comparing valid Host/Extension releases.
- [x] 4.3 Attempt update only when the first-registration trigger is true and the Host is older; do nothing on equality, never auto-downgrade a newer Host, and retain only the validated target for explicit retry.
- [x] 4.4 Keep the established Host connection and ordinary capabilities alive on package-unavailable and every other update failure; never report an uncommitted target or automatically retry in the same Host process.
- [x] 4.5 On verified success or an already committed target, flush restart-pending, close Host-owned services cleanly, exit the old process, and verify the stable-launcher replacement completes normal registration without a second automatic update trigger.
- [x] 4.6 Add integration tests for matching, older, newer, malformed, unavailable-package, offline, timeout, disconnect-during-update, concurrent-browser, retry, successful restart, and failed-update connection continuity.

## 5. Extension State and Settings Presentation

- [x] 5.1 Use one manifest-identity helper for semantic `version_name`, numeric build metadata, registration, and local Settings presentation.
- [x] 5.2 Consume the automatic update-check trigger on the first registration of each Extension background lifetime and keep reconnect registrations in that lifetime non-triggering.
- [x] 5.3 Derive `bridgeConnected` from transport plus completed browser registration rather than release equality, keeping providers, integrations, CDP, targets, and control available during pending or failed maintenance under their existing gates.
- [x] 5.4 Render muted `v<version_name>` beside the localized Settings title with full stable/Beta accessibility, narrow-layout ellipsis, and disconnected visibility.
- [x] 5.5 Make maintenance presentation non-blocking: package-unavailable remains quiet, pending/failed update does not render the missing-Host guide, newer Host offers no downgrade, and restart-pending alone may show reconnect progress.
- [x] 5.6 Preserve authorization selection across maintenance/restart without granting or exercising it, and add Side Panel/background tests for stable/Beta labels, one-shot triggering, normal mismatched readiness, quiet failure, success reconnect, and retry routing.

## 6. Lightweight Release and Operating Evidence

- [x] 6.1 Keep stable/Beta validation limited to Extension `version_name`, embedded Host self-check, Bridge/setup package, and inventory identity while Chromium numeric `version` stays separate.
- [x] 6.2 Remove post-publication npm polling and synthetic registry-availability acceptance; document that runtime package absence quietly preserves the installed Host and connection.
- [x] 6.3 Keep packed-consumer smoke focused on ordinary setup, self-check/launcher, custom Extension identity, optional-integration preservation, doctor, update, and uninstall across existing CI platforms.
- [x] 6.4 Update setup/operating and compatibility documentation for non-blocking older-Host maintenance, quiet package absence, success-only reconnect, manual no-downgrade rollback, and unchanged automation/browser classifications.
- [ ] 6.5 Verify in a real daily Chrome session that an older Host connects normally before maintenance, a failed attempt preserves connection/authorization boundaries, and a successful exact update reconnects without a second attempt; retain no screenshots, logs, prompts, or machine-specific output.

## 7. Final Validation and Cleanup

- [x] 7.1 Run focused protocol, Bridge, setup, Extension, release-identity, and managed-installation tests, including adversarial version/package/lock inputs and update failure injection.
- [x] 7.2 Run `pnpm install --frozen-lockfile`, `pnpm run check`, `pnpm run release:check`, `openspec validate --all --strict`, and `git diff --check`.
- [x] 7.3 Remove temporary Host trees, update locks, runner caches, screenshots, browser logs, and machine-specific verification output, then confirm only intentional source, RFC, spec, fixture, and compatibility changes remain.
