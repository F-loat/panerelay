## Purpose

Define non-blocking Native Host release comparison and safe best-effort self-update without making version drift or package availability a prerequisite for an otherwise usable Panerelay connection.

## ADDED Requirements

### Requirement: Native Host registration reports release identity without gating connection

The Panerelay Extension SHALL report its semantic release from manifest `version_name` and numeric Chromium build metadata during Native Messaging registration, and the Native Host SHALL report the semantic release embedded in its running bundle. After validating the configured Extension identity and required registration shape, the Host SHALL complete ordinary browser registration before starting version maintenance. A valid older or newer Host release MUST NOT by itself block Agent, integration, CDP, target, or control capabilities available through that connection.

#### Scenario: Extension and Host releases match

- **GIVEN** an authenticated Extension and the running Native Host report the same valid semantic release
- **WHEN** the Host processes browser registration
- **THEN** it acknowledges the browser normally and includes its Host release
- **AND** it does not launch an update

#### Scenario: Host release differs

- **GIVEN** an authenticated Extension and Native Host report different valid semantic releases
- **WHEN** the Host processes browser registration
- **THEN** it acknowledges and publishes the usable browser connection before version maintenance
- **AND** normal Host-backed operations remain governed only by their existing provider, integration, authorization, and control gates

#### Scenario: Registration identity is missing or malformed

- **GIVEN** the required semantic release or numeric build identity is absent or malformed
- **WHEN** the Host validates registration
- **THEN** it rejects that malformed protocol message without constructing a package selector
- **AND** it does not change local files, registry state, browser authority, targets, or control leases from the invalid message

### Requirement: Extension startup triggers at most one automatic comparison attempt

The Extension SHALL request automatic Host version maintenance only on the first Native Host registration initiated by each Extension background lifetime. A reconnect caused by a successful Host replacement or a transient Native Messaging disconnect in the same background lifetime SHALL still report both versions but SHALL NOT independently request another automatic update attempt.

#### Scenario: Extension background starts

- **GIVEN** the Extension background has started after installation, update, browser startup, or service-worker restart
- **WHEN** it performs its first Native Host registration
- **THEN** it requests one automatic version comparison
- **AND** later registrations in that same background lifetime do not request another automatic attempt

#### Scenario: Updated Host reconnects

- **GIVEN** an older Host completed replacement and exited
- **WHEN** the existing Extension background reconnects through the stable launcher
- **THEN** registration completes normally with the new Host release
- **AND** the reconnect does not create a second update loop

### Requirement: Older Native Host uses one fixed exact-version setup operation

When the one-shot comparison finds the running Host older than the authenticated Extension, the Native Host SHALL invoke only `npx --yes @panerelay/setup@<ExtensionRelease> update --yes` with bounded time and output. The Extension SHALL provide no package name, executable, path, shell fragment, integration flag, or other command material. The operation SHALL NOT update or remove independently managed automation engines, Agent runtimes, Agent Skills, or optional Panerelay integration selections.

#### Scenario: Authenticated newer Extension initiates update

- **GIVEN** normal browser registration has completed and the Host release is older than the authenticated Extension release
- **WHEN** the first-registration update check runs
- **THEN** the Host starts the fixed exact-version non-interactive setup operation in the background
- **AND** the established browser connection remains usable while the attempt is pending

#### Scenario: Exact npm package is unavailable

- **GIVEN** the exact `@panerelay/setup@<ExtensionRelease>` package cannot be resolved or downloaded
- **WHEN** the automatic update attempt settles
- **THEN** the Host contains and sanitizes the package-runner failure without logging or exposing child output
- **AND** it keeps the existing Host connection and capabilities available without reporting the target release as installed

#### Scenario: Extension supplies command-like version material

- **GIVEN** a registration field contains a dist-tag, package specifier, filesystem path, shell syntax, or unsupported prerelease
- **WHEN** the Host validates the message
- **THEN** it rejects the value rather than passing it to a package runner
- **AND** no update process starts

### Requirement: Newer Native Host is never downgraded automatically

When the running Host release is newer than the authenticated Extension release, Panerelay SHALL keep the normal connection available and SHALL NOT automatically install the older Extension-matching package.

#### Scenario: Host release is newer

- **GIVEN** normal registration reports a Host semantic release newer than the Extension semantic release
- **WHEN** the one-shot version comparison runs
- **THEN** the connection remains usable
- **AND** no package runner or automatic downgrade is started

### Requirement: Update success restarts and recovers the connection

Only a verified successful Host replacement SHALL move to restart-pending, close Host-owned services cleanly, and exit the old process. The Extension SHALL preserve reconnect feedback and its authorization selection while using its existing reconnect path. It SHALL restore normal connected presentation after the stable launcher starts a Host that completes registration, whether the reported release is matching or the connection remains usable under the non-blocking version policy.

#### Scenario: Host update succeeds

- **GIVEN** the exact setup operation verified and committed the newer Host
- **WHEN** the old Host settles the update
- **THEN** it flushes restart-pending status, closes owned services, and exits without claiming its old process was updated in place
- **AND** the Extension reconnects through the stable launcher and completes normal registration with the replacement Host

#### Scenario: Host update fails after setup starts

- **GIVEN** setup validation or managed-file replacement fails
- **WHEN** the attempt settles without a committed replacement
- **THEN** the old Host remains connected and usable
- **AND** it does not exit, disconnect the Extension, repeatedly retry, or report the target release as installed

#### Scenario: Extension disconnects during update

- **GIVEN** a valid self-update transaction is already running
- **WHEN** the Extension transport disconnects before setup settles
- **THEN** setup completes or safely aborts its bounded managed-file transaction
- **AND** no browser authorization, target, Agent request, integration mutation, or control lease is retained or created for the disconnected Extension

### Requirement: Concurrent Host updates preserve one launchable installation

Panerelay SHALL serialize Native Host replacement across current-user Chrome and Edge processes. Managed executable, launcher, manifest, and runtime state SHALL be staged and verified before pointer commit, and every failure MUST preserve one launchable prior installation. A process that observes its target already committed SHALL restart instead of performing duplicate replacement work.

#### Scenario: Chrome and Edge detect the same older Host

- **GIVEN** Chrome and Edge have both registered normally through separate older Host processes
- **WHEN** their first-registration checks target the same newer Extension release
- **THEN** cross-process setup ownership serializes managed-file replacement
- **AND** both existing connections remain usable until a process successfully reaches restart-pending

#### Scenario: Replacement fails before commit

- **GIVEN** setup staged but did not commit a replacement Host
- **WHEN** validation, launcher, pointer, registry, or lock handling fails
- **THEN** every registered browser manifest still resolves a launchable prior Host
- **AND** no process reports the target release as installed

### Requirement: Version maintenance remains separate from browser authority

Version comparison, update, failure, retry, success, and reconnect SHALL NOT request Chrome site permission, select or authorize a tab, attach the debugger, create a target binding, acquire or renew a control lease, or infer authority from focus. Existing authorization selections MAY remain visible, and ordinary operations during a pending or failed update SHALL continue to require their normal authorization and lease checks.

#### Scenario: Host updates while an authorization preference exists

- **GIVEN** the Extension retains an existing authorization selection when it connects to an older Host
- **WHEN** background version maintenance runs or fails
- **THEN** the selection remains presentation state only
- **AND** update maintenance neither exercises nor changes that authority

#### Scenario: Update fails while an authorized session is usable

- **GIVEN** an existing connection and its normally authorized operations are usable
- **WHEN** the background Host update fails
- **THEN** version maintenance does not revoke or widen authorization
- **AND** subsequent operations continue through the existing authorization and control rules
