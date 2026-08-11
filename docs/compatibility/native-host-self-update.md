# Native Host self-update compatibility

- Panerelay release: current development candidate
- Protocol: `panerelay.relay.v2`
- Status: Partial
- Last verified: 2026-08-11

## Supported contract

The Extension reports manifest `version_name` and the running Native Host reports its embedded release during ordinary browser registration. Once Extension identity and registration shape are validated, registration completes and the connection stays usable even when the two valid semantic releases differ. Chromium's four-part manifest `version` remains build metadata and never selects an npm package.

Only the first Native Host registration in each Extension background lifetime requests automatic comparison. When the Host is older, it makes one automatic attempt to run the closed command `npx --yes @panerelay/setup@<validated-extension-release> update --yes`. Reconnects in the same background lifetime do not trigger another attempt. The target release comes only from the validated registration message; the Extension cannot provide a package name, executable, arguments, path, or downgrade request.

An unavailable exact npm package is contained quietly without raw output, restart, connection loss, or fallback to a dist-tag. Every other update failure also leaves the registered Host usable. A newer Host remains connected and is never automatically downgraded.

Setup stages an immutable `hosts/<release>/native-host.bundle.cjs`, executes its bounded `--self-check`, refreshes the stable launcher, runtime configuration, Native Messaging manifests, and current-user Windows registrations, then atomically commits `host-current.json`. The currently running old bundle is not replaced. Normal cleanup retains the committed current and previous release only.

## Evidence

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Stable and beta release parsing | Verified | Protocol tests reject Chromium four-part builds, leading zeros, unsupported prereleases, paths, tags, and command-like input. |
| Embedded Host identity and self-check | Verified | Bridge build/runtime tests confirm `--self-check` returns only the exact release and protocol without starting Host services. |
| POSIX stable launcher | Verified | Deterministic tests cover protected pointer validation, paths containing spaces, inherited Native Messaging stdio, exit status, pointer switching, and current/previous retention. |
| Windows launcher and HKCU registration | Partial | Deterministic source fixtures and tests cover quoting, Chrome/Edge registry arguments, pointer selection, and stdio framing. A retained real Windows Chrome/Edge run is still required. |
| Atomic failure recovery | Verified | Failure-injection tests cover staging/self-check, launcher, registry, pointer, and lock failures while retaining a launchable committed release. |
| Chrome/Edge cross-process serialization | Verified | Deterministic tests hold the protected target-aware lock across two update callers and require the waiter to observe the committed target. |
| Packed macOS/Linux/Windows consumer flow | Partial | The lightweight packed smoke covers ordinary setup, update, launcher, doctor, custom Extension identity, optional integrations, and uninstall. Classification stays Partial until all retained platform CI jobs pass for this change. |
| Daily Chrome automatic update and reconnect | Partial | Deterministic tests prove registration precedes the update, reconnect consumes no second automatic attempt, and failure keeps the connection; the required retained daily-profile run has not yet been recorded. |

## Recovery and rollback

If automatic update fails and a manual replacement is desired, run the exact setup command from a terminal. The existing connection remains usable. `doctor` diagnoses the stable launcher, protected pointer, selected bundle, embedded release, active or malformed update lock, manifests, and Windows registry without starting an update:

```bash
npx --yes @panerelay/setup@<extension-version> update --yes
npx --yes @panerelay/setup doctor
```

A newer Host never downgrades itself for an older Extension. Rollback is explicit and manual. Pre-`panerelay.relay.v2` Hosts are intentionally not migrated; during this early project phase, replace them with a clean setup.

Base Host update preserves a protected custom Extension ID, runtime path entries, and optional Panerelay integration selections. Normal base Setup also ensures that the exact lockstep `@panerelay/cli` release is present, but updates or removes it only while its protected ownership record still matches the installed version; pre-existing and externally changed CLI installations are preserved. Setup does not install, update, downgrade, or reclassify agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, or Playwright CLI 0.1.17. Chrome and Edge capability classifications outside Host release management are unchanged.
