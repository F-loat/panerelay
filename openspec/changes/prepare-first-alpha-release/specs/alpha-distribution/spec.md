## Purpose

Define how Panerelay produces a lockstep, locally verifiable alpha distribution without publishing
artifacts or widening the browser access granted by the user.

## ADDED Requirements

### Requirement: Alpha artifacts have one release identity

Panerelay SHALL assign one semantic prerelease version to every publishable package and expose the
same human-readable version in the Extension.

#### Scenario: Release metadata is aligned

- **GIVEN** a maintainer prepares an alpha candidate
- **WHEN** the release check reads workspace, package, and Extension metadata
- **THEN** every publishable package and the Extension version name identify the same alpha release

#### Scenario: Metadata drifts

- **GIVEN** one package, internal dependency, or Extension version no longer matches the release
  identity
- **WHEN** the release check runs
- **THEN** it fails before producing an accepted candidate

### Requirement: Candidate creation is local and non-publishing

Panerelay SHALL build inspectable npm tarballs, an unpacked-Extension archive, and checksums without
contacting a package publication or release API.

#### Scenario: Maintainer builds a candidate

- **GIVEN** the repository passes normal quality checks
- **WHEN** the maintainer runs the release packaging command
- **THEN** Panerelay writes a versioned candidate directory with the expected package tarballs,
  Extension archive, inventory, and checksums

#### Scenario: Candidate contents are incomplete

- **GIVEN** a required executable, runtime file, Skill, manifest, or package export is absent
- **WHEN** candidate validation inspects the packed artifacts
- **THEN** it fails closed and identifies the incomplete artifact

### Requirement: Packed setup works outside the workspace

Panerelay SHALL verify the setup package and its internal dependencies from packed tarballs in an
isolated consumer environment.

#### Scenario: Fresh local install

- **GIVEN** all Panerelay npm tarballs were produced from one candidate
- **WHEN** an isolated consumer installs them without workspace links
- **THEN** the setup CLI can display help and install, diagnose, update, and uninstall its
  user-scoped integration

#### Scenario: Packed dependency would require workspace state

- **GIVEN** a packed package still references a workspace-only path or an unavailable Panerelay
  dependency
- **WHEN** the isolated smoke test installs the candidate
- **THEN** the release check fails instead of accepting the tarball

### Requirement: Distribution preserves browser authorization boundaries

Panerelay SHALL keep Extension installation, Native Host setup, Provider registration, and browser
tab authorization as separate user-controlled steps.

#### Scenario: Local integration is installed

- **GIVEN** the setup CLI registered the Native Host and agent-browser Provider
- **WHEN** no tab has been authorized in the Panerelay side panel
- **THEN** the Provider cannot control a browser tab

#### Scenario: Unsupported platform is used

- **GIVEN** a user runs setup on a platform without a supported Native Messaging installation path
- **WHEN** setup attempts installation
- **THEN** it fails with an actionable platform limitation and does not claim readiness

### Requirement: Alpha operation and limitations are documented

Panerelay SHALL document one end-to-end alpha workflow covering Extension loading, setup, Provider
selection, diagnosis, update, rollback, and uninstall.

#### Scenario: User follows the alpha quickstart

- **GIVEN** a user has a supported Chrome browser, Node.js 20 or newer, and agent-browser 0.33.0
- **WHEN** the user follows the documented quickstart
- **THEN** every required human authorization step and verification command is explicit

#### Scenario: User evaluates unsupported behavior

- **GIVEN** the alpha reuses a daily Chrome profile
- **WHEN** the user reads the release limitations
- **THEN** browser-process ownership, isolation, download, platform, protocol lockstep, and
  multi-Agent limitations remain explicit

### Requirement: CI checks release readiness without releasing

Panerelay SHALL run candidate validation on supported Node.js versions without publishing,
tagging, or uploading artifacts.

#### Scenario: Pull request changes distributable files

- **GIVEN** CI runs for a pull request or the main branch
- **WHEN** normal checks and release validation complete
- **THEN** the build is accepted only when both source quality and packed-artifact checks pass

#### Scenario: Publication credentials are absent

- **GIVEN** release-readiness CI has no npm or GitHub publication credential
- **WHEN** candidate validation runs
- **THEN** it still completes without requiring an external write

### Requirement: npm publication is explicit and rebuilds packages

Panerelay SHALL expose one explicitly invoked alpha publication command that publishes the four
public packages through pnpm with the `alpha` dist-tag.

#### Scenario: Maintainer publishes the accepted alpha

- **GIVEN** the release commit is clean, pushed, and accepted
- **WHEN** an authorized maintainer runs the alpha publication command with npm authentication
- **THEN** protocol, agent-browser, Bridge, and setup build through their package lifecycle and
  publish in dependency order

#### Scenario: Candidate validation runs without publication authority

- **GIVEN** a maintainer or CI only runs release checking or candidate packaging
- **WHEN** those commands complete
- **THEN** they never invoke the npm publication command
