## ADDED Requirements

### Requirement: Setup installs source-form and explicit GitHub adapters

Setup SHALL accept the existing strict two-file install source, a local site-toolkit source directory, an owner/repository GitHub shorthand, and a canonical public GitHub repository URL with optional ref and subdirectory selection. It SHALL resolve every remote source into a bounded temporary directory, record a normalized provenance value and resolved commit for the installed adapter, build source-form adapters through the lockstep toolkit, and then apply the existing validation and atomic installation transaction. An omitted ref SHALL resolve once to the repository's current default-branch commit rather than remaining a floating installed identity.

#### Scenario: User installs a local source adapter

- **GIVEN** a local directory contains a valid site-toolkit source adapter and no generated artifacts
- **WHEN** the user passes that directory to setup add
- **THEN** setup builds it in temporary staging and installs the resulting strict two-file source
- **AND** it does not write generated artifacts into the author's source directory

#### Scenario: User installs a GitHub adapter by shorthand

- **GIVEN** an owner/repository source identifies a public repository containing one unambiguous adapter source
- **WHEN** the user passes that source to setup add
- **THEN** setup resolves the repository's default branch to one commit, builds and validates the adapter, and records that commit with the installation
- **AND** later repository changes do not alter the installed executable until the user explicitly installs again

#### Scenario: User selects a repository ref and subdirectory

- **GIVEN** a public repository contains multiple adapters or the desired adapter is not at its root
- **WHEN** the user supplies a supported immutable or named ref and source subdirectory
- **THEN** setup resolves that selection within the fetched repository and installs only the selected adapter
- **AND** path traversal, repository escape, ambiguous discovery, or a missing ref fails before installation

#### Scenario: Remote source batch fails

- **GIVEN** a batch combines built-in, local, and GitHub sources and one source cannot be fetched, built, or validated
- **WHEN** setup prepares the batch
- **THEN** no requested registry entry or active adapter directory is changed
- **AND** all temporary remote and build directories are removed

### Requirement: Remote adapter resolution is explicit and bounded

Setup SHALL perform network access only for an explicitly supplied supported remote source. It SHALL accept only HTTPS GitHub repository content in the first version, enforce repository and extracted-file bounds, reject symlinks and unsafe archive entries, and SHALL NOT search a registry, interpret an unknown bare adapter ID as a remote package, manage private Git credentials, run Git hooks, install repository dependencies, or execute repository package and build scripts.

#### Scenario: Unknown bare adapter name is supplied

- **GIVEN** a value is neither a built-in ID, an existing local path, nor a supported explicit GitHub source
- **WHEN** setup resolves it
- **THEN** setup returns the bounded unknown-source error
- **AND** it performs no network request or ambient package lookup

#### Scenario: GitHub archive is unsafe or oversized

- **GIVEN** a fetched repository exceeds a documented bound or contains a symlink, absolute path, traversal path, unsupported file type, or oversized source file
- **WHEN** setup extracts and validates it
- **THEN** setup fails closed and removes the temporary content
- **AND** it does not run or install any repository code

#### Scenario: Private repository needs authentication

- **GIVEN** GitHub rejects a repository request because it is private or requires credentials
- **WHEN** setup resolves the source
- **THEN** setup reports that authenticated GitHub sources are unsupported in this version
- **AND** it does not prompt for, retain, or print a token
