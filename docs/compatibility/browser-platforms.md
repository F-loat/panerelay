# Browser platform compatibility

- Panerelay release: current development candidate
- Extension target: shared Chromium Manifest V3
- agent-browser baseline: 0.33.0
- Playwright CLI baseline: 0.1.17
- Last verified: 2026-08-07

## Status meanings

- **Verified**: covered by deterministic tests; runtime capabilities also require retained real-browser evidence linked from the relevant compatibility record.
- **Forwarded**: shares the tested Chromium API and Panerelay relay path, but a dedicated real-browser acceptance run is pending.
- **Unsupported**: the capability requires browser-process ownership or another guarantee the Extension-backed architecture cannot provide and fails explicitly.

This record distinguishes deterministic installation and artifact coverage from runtime evidence. Chrome daily-profile evidence remains in [agent-browser 0.33.0 compatibility](agent-browser-0.33.0.md). Complete representative Edge runtime acceptance is not yet recorded, so Edge runtime capabilities do not inherit Chrome's `Verified` classification.

## Runtime capabilities

| Capability                                                  | Chrome / Chromium | Microsoft Edge |
| ----------------------------------------------------------- | ----------------- | -------------- |
| Native Messaging                                            | Verified          | Forwarded      |
| Side panel                                                  | Verified          | Forwarded      |
| Codex, Claude Code, and Qoder conversations                 | Verified          | Forwarded      |
| OpenCode 1.18.12 conversations                              | Forwarded         | Forwarded      |
| Project selection and page comments                         | Verified          | Forwarded      |
| Explicit site and tab authorization                         | Verified          | Forwarded      |
| Browser-level CDP relay                                     | Verified          | Forwarded      |
| Browser-backed fetch                                        | Partial           | Partial        |
| agent-browser 0.33.0 Provider                               | Verified          | Forwarded      |
| Playwright CLI 0.1.17 explicit CDP attach                   | Verified          | Forwarded      |
| Independent registration and deterministic browser routing  | Verified          | Forwarded      |
| Target lifecycle, control badge, and favicon                | Verified          | Forwarded      |
| Immediate revocation and cleanup                            | Verified          | Forwarded      |
| Isolated contexts and disposable profiles                   | Unsupported       | Unsupported    |
| Launch-time proxy, executable, flag, or extension selection | Unsupported       | Unsupported    |
| Browser-wide close and top-level request containment        | Unsupported       | Unsupported    |

Edge uses the same Chromium Manifest V3 artifact, side-panel graph, debugger relay, permission flow, opaque target model, control lease, and revocation implementation as Chrome. It registers `browserFamily: "edge"` and declares CDP relay support only from feature detection.

Chrome and Edge Native Hosts persist independent protected registrations. Provider contract tests verify explicit selection, saved defaults, single-ready selection, ambiguity failures, unavailable-default failures, browser-pinned cleanup, and legacy-singleton migration. These deterministic routing claims do not upgrade Edge's runtime classification: representative Edge Provider evidence is still pending.

OpenCode discovery tests additionally cover explicit-override precedence, legacy runtime migration, live reconstructed-PATH precedence, and an all-provider query that leaves a stale persisted fallback untouched after a live candidate succeeds. A local macOS setup refresh and all-provider discovery check selected OpenCode 1.18.12 without producing a new execution-policy event. Dedicated daily-profile Side Panel acceptance remains pending, so OpenCode conversations stay `Forwarded` for both Chrome and Edge.

The optional `@panerelay/cli` package uses the same engine-neutral registry for bounded listing and saved-default changes. Unit and packed-consumer tests cover its executable entry, English and Chinese output, explicit selector precedence, credential omission, and setup-command separation. These package-level checks also do not upgrade Edge runtime capabilities beyond `Forwarded`.

## Installation and artifacts

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| macOS Edge discovery | Verified | Installer tests cover Edge stable, Beta, Dev, and Canary per-user Native Messaging paths. |
| Linux Edge discovery | Verified | Installer tests cover Edge stable, Beta, and Dev per-user Native Messaging paths. |
| Windows current-user registration | Verified | Lifecycle and doctor tests cover distinct Google Chrome and Microsoft Edge HKCU keys pointing to one managed manifest. |
| Identity validation and persistence | Verified | Chrome and Edge use the same configured Chromium Extension ID and exact `allowed_origins` entry. |
| Native Host self-update | Partial | The stable launcher, exact package selection, lock, failure recovery, and packed consumers are covered deterministically; retained daily Chrome and real Windows Chrome/Edge evidence is still pending. See [Native Host self-update compatibility](native-host-self-update.md). |
| Uninstall | Verified | Tests cover removing both browser registrations and the managed versioned Host layout without touching unrelated hosts. |
| Shared Chromium Extension archive | Verified | Candidate validation retains one manifest, public key, Extension ID, and complete asset graph for Chrome and Edge. |
| Standalone administration CLI | Verified | Candidate validation packs and installs `@panerelay/cli` with its registry dependency, then invokes browser-list and default-clear commands in an isolated consumer. |
| Chrome Web Store installation in Edge | Forwarded | Microsoft documents installing Chrome Web Store extensions in Edge; dedicated Panerelay installation evidence remains pending. |
| Microsoft Edge Add-ons publication | Unsupported | No Edge Add-ons listing or separately signed Edge identity is part of this change. |

## Security boundary

Browser family and CDP capability metadata do not grant access. Site permission, tab authorization, browser selection, and the current control lease remain separate. Focus never grants authorization or selects a browser. Compatible older Chrome registrations without capability data retain prior behavior, while any explicit `cdpRelay: false` value is authoritative and fails before automation state is allocated.
