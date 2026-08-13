## MODIFIED Requirements

### Requirement: Setup installs source-form and explicit GitHub adapters

Setup SHALL accept the existing strict two-file install source, a local site-toolkit source directory, an owner/repository GitHub shorthand, a canonical public GitHub repository URL with optional ref and subdirectory selection, and `<built-in-id>@<ref>` as an official-source alias. It SHALL resolve every remote source into a bounded temporary directory, record a normalized provenance value and resolved commit for the installed adapter, build source-form adapters through the lockstep toolkit, and then apply the existing validation and atomic installation transaction. An omitted ref SHALL resolve once to the repository's current default-branch commit rather than remaining a floating installed identity.

When Git is available, Setup SHALL prefer a non-interactive `git ls-remote` against the explicit public HTTPS repository URL to resolve a named ref or default branch to a full commit. It SHALL fall back to the unauthenticated GitHub API only when Git is unavailable. It SHALL NOT clone or checkout the repository, initialize submodules, execute hooks, prompt for credentials, or use credential helpers. A Git lookup failure SHALL fail explicitly rather than silently changing transports. A supplied full commit SHALL remain its own immutable resolved identity.

When an explicit GitHub source uses a single path segment after `#`, Setup SHALL treat that segment as an adapter-name selector and inspect only this ordered candidate list: `<name>`, `sites/<name>`, `adapters/<name>`, `packages/sites/src/<name>`, `packages/sites/<name>`, and `src/sites/<name>`. It SHALL select the first adapter-shaped candidate and record its resolved repository-relative subdirectory. A multi-segment subdirectory SHALL remain an exact selection.

#### Scenario: User installs a local source adapter

- **GIVEN** a local directory contains a valid site-toolkit source adapter and no generated artifacts
- **WHEN** the user passes that directory to setup add
- **THEN** setup builds it in temporary staging and installs the resulting strict two-file source
- **AND** it does not write generated artifacts into the author's source directory

#### Scenario: User installs a GitHub adapter by shorthand

- **GIVEN** an owner/repository source identifies a public repository containing one adapter source at its root
- **WHEN** the user passes that source to setup add
- **THEN** setup resolves the repository's default branch to one commit, builds and validates the adapter, and records that commit with the installation
- **AND** later repository changes do not alter the installed executable until the user explicitly installs again

#### Scenario: Git resolves a public repository ref

- **GIVEN** Git is available and the user supplies a supported explicit GitHub source
- **WHEN** setup resolves its selected ref
- **THEN** setup uses non-interactive `git ls-remote` with credential helpers disabled and selects one full commit deterministically
- **AND** it downloads only the commit-pinned codeload archive without cloning or checking out the repository

#### Scenario: Git is unavailable

- **GIVEN** no Git executable is available
- **WHEN** setup resolves a supported explicit GitHub source
- **THEN** setup uses the existing unauthenticated GitHub API metadata path
- **AND** archive download, validation, and provenance remain unchanged

#### Scenario: User selects a repository ref and subdirectory

- **GIVEN** a public repository contains multiple adapters or the desired adapter is not at its root
- **WHEN** the user supplies a supported immutable or named ref and a multi-segment source subdirectory
- **THEN** setup resolves that exact selection within the fetched repository and installs only the selected adapter
- **AND** path traversal, repository escape, or a missing ref fails before installation

#### Scenario: User selects an adapter by short repository path

- **GIVEN** a public repository contains adapter-shaped directories at one or more documented common locations for the supplied one-segment name
- **WHEN** the user supplies `owner/repository#<name>`
- **THEN** setup selects the first matching candidate in the documented priority order and installs that adapter
- **AND** its provenance records the resolved repository-relative subdirectory rather than only the short selector

#### Scenario: User selects an unreleased built-in adapter

- **GIVEN** an adapter ID exists in Setup's lockstep built-in catalog
- **WHEN** the user supplies `<built-in-id>@<ref>`
- **THEN** setup resolves that adapter from the official Panerelay GitHub repository at the supplied ref and documented built-in source path
- **AND** it records the official repository, requested ref, resolved commit, and canonical source subdirectory

#### Scenario: Remote source batch fails

- **GIVEN** a batch combines built-in, local, and GitHub sources and one source cannot be fetched, built, or validated
- **WHEN** setup prepares the batch
- **THEN** no requested registry entry or active adapter directory is changed
- **AND** all temporary remote and build directories are removed

### Requirement: Remote adapter resolution is explicit and bounded

Setup SHALL perform network access only for an explicitly supplied supported remote source or a known built-in ID with an explicit ref. It SHALL accept only HTTPS GitHub repository content, enforce repository and extracted-file bounds, reject symlinks and unsafe archive entries, and SHALL NOT search a registry, recursively scan a repository, interpret an unknown bare adapter ID or unknown `<id>@<ref>` as a remote package, manage private Git credentials, clone or checkout repositories, run Git hooks, install repository dependencies, or execute repository package and build scripts. Common-path selection SHALL inspect only the documented finite candidate list in order.

Setup SHALL ignore bounded GitHub codeload global PAX metadata rather than interpreting it as a filesystem entry or applying metadata attributes to extracted files. It SHALL permit at most 4,096 archive entries while retaining the existing compressed-byte, expanded-byte, per-file, path-depth, traversal, link, and file-type limits.

#### Scenario: Unknown bare adapter name is supplied

- **GIVEN** a value is neither a built-in ID, an existing local path, nor a supported explicit GitHub source
- **WHEN** setup resolves it
- **THEN** setup returns the bounded unknown-source error
- **AND** it performs no network request or ambient package lookup

#### Scenario: Unknown built-in ref alias is supplied

- **GIVEN** the caller supplies `<unknown-id>@<ref>` and that ID is absent from the built-in catalog
- **WHEN** setup resolves it
- **THEN** setup returns the bounded unknown-source error
- **AND** it performs no GitHub request

#### Scenario: Short selector has no common-path match

- **GIVEN** a public repository has no adapter-shaped directory at any documented candidate for the selected name
- **WHEN** setup resolves `owner/repository#<name>`
- **THEN** setup reports that no common adapter source matched and lists the bounded candidate paths it checked
- **AND** it does not recursively inspect any other repository directory

#### Scenario: GitHub archive is unsafe or oversized

- **GIVEN** a fetched repository exceeds a documented bound or contains a symlink, absolute path, traversal path, unsupported file type, or oversized source file
- **WHEN** setup extracts and validates it
- **THEN** setup fails closed and removes the temporary content
- **AND** it does not run or install any repository code

#### Scenario: GitHub archive contains global PAX metadata

- **GIVEN** GitHub codeload emits a bounded global PAX metadata record before repository entries
- **WHEN** setup extracts the archive
- **THEN** setup ignores that metadata record and continues validating ordinary repository entries
- **AND** it does not apply metadata attributes to extracted paths or files

#### Scenario: Private repository needs authentication

- **GIVEN** GitHub rejects a repository request because it is private or requires credentials
- **WHEN** setup resolves the source
- **THEN** setup reports that authenticated GitHub sources are unsupported in this version
- **AND** it does not prompt for, retain, or print a token
