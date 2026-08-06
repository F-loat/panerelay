## ADDED Requirements

### Requirement: Release artifacts retain one semantic Host identity

Panerelay SHALL embed the candidate semantic release in the Native Host bundle and SHALL validate that Extension `version_name`, Bridge/Host release, setup package, and retained inventory identify the same stable or beta release. Chromium's numeric manifest `version` SHALL remain separate ordering metadata and MUST NOT select an npm package.

#### Scenario: Stable candidate identities are validated

- **GIVEN** a stable candidate contains the Extension, Host bundle, setup package, and inventory
- **WHEN** lightweight release identity validation runs
- **THEN** their semantic identities match the same plain `X.Y.Z` release
- **AND** the four-part Chromium build version remains separate

#### Scenario: Beta candidate identities are validated

- **GIVEN** a beta workflow derives one prerelease semantic identity and one numeric Chromium build identity
- **WHEN** release identity validation runs
- **THEN** Host and setup artifacts embed the exact `X.Y.Z-beta.N` identity selected by `version_name`
- **AND** no update path selects a moving beta dist-tag or the numeric build identity

#### Scenario: Release identities drift

- **GIVEN** the embedded Host version, Extension `version_name`, setup package version, or retained inventory differs
- **WHEN** release validation runs
- **THEN** it fails the candidate identity check

### Requirement: Runtime package absence is contained without a publication availability gate

Panerelay SHALL NOT require release validation to poll npm for the exact setup package after publication. If the exact package is temporarily absent, unpublished, or unreachable when a running older Host attempts maintenance, the Host SHALL contain that runtime failure and preserve its established connection and installed release.

#### Scenario: Exact setup package cannot be downloaded

- **GIVEN** a distributed Extension release is newer than the connected Host but its exact setup package cannot currently be resolved
- **WHEN** the Host attempts its one automatic update
- **THEN** the attempt fails quietly without child-output disclosure, Host crash, or connection loss
- **AND** a future Extension background restart may make one new best-effort attempt

### Requirement: Acceptance focuses on safe connection and replacement behavior

Panerelay SHALL cover version parsing, embedded self-check, normal mismatched registration, exact package-runner construction, quiet unavailable-package handling, staged replacement, locking, success-only restart, reconnect, Side Panel version display, and authorization separation with focused tests. Existing release smoke MAY continue to cover ordinary setup, doctor, launcher, and uninstall without synthesizing npm registry availability.

#### Scenario: Focused self-update acceptance runs

- **GIVEN** a development or release candidate
- **WHEN** protocol, Bridge, setup, Extension, and managed-installation tests run
- **THEN** a mismatched valid Host registers normally and failed maintenance preserves that connection
- **AND** successful replacement restarts through the stable launcher and reconnects normally

#### Scenario: Automation compatibility is reviewed after self-update

- **GIVEN** Host maintenance tests pass
- **WHEN** maintainers review compatibility groups
- **THEN** agent-browser remains pinned at 0.33.0, Browser Use at 0.13.7 with Browser Harness 0.1.8, and Playwright CLI at 0.1.17
- **AND** no Chrome, Edge, or automation capability classification changes solely because update transport succeeded
