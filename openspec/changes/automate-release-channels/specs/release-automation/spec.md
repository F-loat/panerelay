## Purpose

Define an explicitly authorized, repeatable publication workflow for stable and beta Panerelay packages and downloadable Chrome Extension archives.

## ADDED Requirements

### Requirement: Maintainers explicitly select a release channel

Panerelay SHALL expose a manually triggered publication workflow with exactly `stable` and `beta` channels, SHALL run it through a protected release environment, and SHALL serialize publication attempts.

#### Scenario: Maintainer starts a release

- **GIVEN** a maintainer can dispatch the protected release workflow
- **WHEN** the maintainer selects `stable` or `beta`
- **THEN** the workflow checks out the selected commit, runs the release gates, and prepares only that channel

#### Scenario: Unsupported or overlapping publication is attempted

- **GIVEN** a channel is invalid or another publication is still active
- **WHEN** the workflow evaluates the request
- **THEN** it rejects the invalid request or waits without cancelling the active publication

### Requirement: Beta identity is ephemeral and workflow-scoped

Panerelay SHALL derive a semantic beta version from the repository's stable version and GitHub run number, SHALL use the derived identity across every package, the Extension `version_name`, archive names, and inventory, and SHALL NOT commit or push the temporary version changes. Retrying the same workflow run SHALL reuse the same public npm beta version.

#### Scenario: Beta candidate is prepared

- **GIVEN** the repository identifies stable version `X.Y.Z` and the workflow has a positive run number and attempt
- **WHEN** the beta channel prepares a candidate
- **THEN** every publishable package and human-readable Extension identity uses `X.Y.Z-beta.<run>`
- **AND** the Chrome numeric version is derived deterministically from numeric workflow values

#### Scenario: Beta workflow is retried

- **GIVEN** a beta workflow run already prepared `X.Y.Z-beta.<run>`
- **WHEN** the same run is retried with a later attempt
- **THEN** the public npm beta version remains `X.Y.Z-beta.<run>`
- **AND** publication retry accepts only already-published tarballs with identical integrity

#### Scenario: Beta preparation finishes or fails

- **GIVEN** beta preparation temporarily changed release metadata in the runner workspace
- **WHEN** candidate preparation completes or throws an error
- **THEN** the source files are restored and no version change is committed or pushed

### Requirement: Published npm packages match the verified candidate

Panerelay SHALL publish the four validated candidate tarballs in dependency order, use npm distribution tag `latest` for stable and `beta` for beta, and verify that any already-published version has identical integrity before treating a retry as successful.

#### Scenario: New channel version is published

- **GIVEN** all four candidate versions are absent from npm
- **WHEN** publication runs for a selected channel
- **THEN** it publishes the exact retained tarballs in protocol, agent-browser adapter, Bridge, and setup order with the channel's distribution tag

#### Scenario: Publication resumes after a partial failure

- **GIVEN** an earlier attempt published only some candidate tarballs
- **WHEN** the same candidate is retried
- **THEN** the workflow skips byte-identical published tarballs and publishes the missing tarballs

#### Scenario: Immutable package content conflicts

- **GIVEN** npm already contains the selected name and version with different integrity
- **WHEN** publication preflight runs
- **THEN** the workflow fails before overwriting or accepting the conflicting package

### Requirement: Every channel provides a downloadable Extension

Panerelay SHALL upload the verified Extension zip, inventory, and checksums as a GitHub Actions artifact for both stable and beta workflow runs.

#### Scenario: Channel candidate succeeds

- **GIVEN** the selected candidate passed package, Extension, integrity, and packed-consumer validation
- **WHEN** the workflow reaches artifact upload
- **THEN** the run exposes a downloadable artifact named with the exact channel version and containing the Extension zip, inventory, and checksums

### Requirement: Stable publication creates a GitHub Release

Panerelay SHALL create tag `v<version>` and a non-prerelease GitHub Release for a successful stable publication, attach the exact Extension zip, inventory, and checksums, and target the workflow commit.

#### Scenario: Stable packages are published

- **GIVEN** stable validation passes, the tag and release do not already exist, and all npm packages are published or integrity-matched
- **WHEN** the stable workflow completes
- **THEN** it creates the stable tag and GitHub Release for the selected commit with the verified assets

#### Scenario: Stable tag or release already exists

- **GIVEN** the selected stable tag or GitHub Release already exists
- **WHEN** stable preflight runs
- **THEN** the workflow fails before publishing a new stable candidate

### Requirement: Beta publication does not create durable repository release state

Panerelay SHALL NOT create or push a Git tag, GitHub Release, commit, or branch for a beta publication.

#### Scenario: Beta publication completes

- **GIVEN** the beta packages and downloadable Extension artifact were produced successfully
- **WHEN** the workflow finishes
- **THEN** npm exposes the version through the `beta` distribution tag while Git history, tags, branches, and GitHub Releases remain unchanged
