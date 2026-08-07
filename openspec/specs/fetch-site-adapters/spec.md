# fetch-site-adapters Specification

## Purpose

Define a versioned, protected, setup-managed site-adapter format that gives browser fetch reusable OpenCLI-style site commands without making adapter code part of the Panerelay CLI process.

## Requirements

### Requirement: Fetch adapters use a versioned installable format

A fetch site adapter SHALL consist of a strict versioned manifest and one self-contained executable entry artifact. The manifest SHALL declare an adapter ID, display name, version, description, protocol version, executable entry, and bounded command metadata including each command's name, description, access classification, arguments, output fields, and examples. Adapter and command identifiers SHALL be lowercase, bounded, and unique.

#### Scenario: Local adapter directory is valid

- **GIVEN** a local directory contains the expected manifest and self-contained entry artifact
- **WHEN** setup validates the directory
- **THEN** setup accepts only declared safe relative paths and well-formed metadata
- **AND** it does not execute adapter code during validation or installation

#### Scenario: Adapter format is invalid

- **GIVEN** an adapter has an unknown protocol, unsafe path, symlink, duplicate command, undeclared file, oversized artifact, or malformed metadata
- **WHEN** setup evaluates it
- **THEN** setup rejects that adapter before changing its active installation

### Requirement: Setup manages built-in and local fetch adapters

`@panerelay/setup` SHALL provide `add <adapter-id|local-directory>...`, `add --all`, `remove <adapter-id>...`, `remove --all`, and `adapters` operations. All built-in artifacts SHALL ship in one public lockstep `@panerelay/sites` catalog package, and setup SHALL depend on its exact release version without embedding site bundles or installing one npm package per site. Named adapters SHALL resolve only from that catalog, `--all` SHALL apply to it, local directories SHALL use the public adapter format, and multiple requested adapters SHALL be validated before setup replaces their user-scoped protected installations and registry entries under `~/.panerelay/fetch-adapters/`.

#### Scenario: User installs one built-in adapter

- **GIVEN** Bilibili is available in the lockstep built-in catalog
- **WHEN** the user runs `npx --yes @panerelay/setup add bilibili`
- **THEN** setup installs or updates only the Bilibili adapter and its registry entry
- **AND** it does not run base setup, install an automation engine, or change browser defaults

#### Scenario: Published setup resolves the aggregate catalog

- **GIVEN** matching packed `@panerelay/setup` and `@panerelay/sites` versions
- **WHEN** a consumer installs setup and adds Bilibili
- **THEN** setup copies the Bilibili two-file source from the aggregate catalog package
- **AND** the setup package contains no embedded site bundle

#### Scenario: User installs multiple adapters

- **GIVEN** all requested built-in IDs or local directories are valid
- **WHEN** the user supplies multiple values to `add` or uses `add --all`
- **THEN** setup installs each selected adapter in deterministic order
- **AND** a failure validating one requested adapter leaves every previously active requested adapter unchanged

#### Scenario: User lists installed adapters

- **GIVEN** zero or more fetch adapters are installed
- **WHEN** the user runs `npx --yes @panerelay/setup adapters`
- **THEN** setup lists bounded manifest metadata without executing an adapter
- **AND** it does not expose executable source, Bridge credentials, cookies, or browser state

### Requirement: Setup removes only selected fetch adapters

Setup SHALL remove one or more named fetch adapters or all registered fetch adapters without deleting unrelated `~/.panerelay` state. Removal SHALL update the registry atomically and be idempotent for an already absent adapter.

#### Scenario: User removes one adapter

- **GIVEN** Bilibili and another fetch adapter are installed
- **WHEN** the user runs `npx --yes @panerelay/setup remove bilibili`
- **THEN** setup removes the Bilibili registry entry and Panerelay-owned Bilibili adapter files
- **AND** it preserves the other adapter, Native Host, browser registry, automation adapters, and defaults

#### Scenario: User removes all adapters

- **GIVEN** one or more fetch adapters are installed
- **WHEN** the user runs `npx --yes @panerelay/setup remove --all`
- **THEN** setup removes the fetch-adapter registry and all Panerelay-owned fetch-adapter installation directories
- **AND** a repeated invocation succeeds without affecting unrelated state

### Requirement: CLI discovers help without executing adapter code

The Panerelay CLI SHALL render `panerelay fetch --help` from built-in raw-fetch help and protected installed manifest metadata. It SHALL render `panerelay fetch <site> --help` and command help from the matching manifest and SHALL fail explicitly for an uninstalled site or unknown command. Help discovery SHALL NOT execute the adapter or read live Bridge credentials.

#### Scenario: Top-level fetch help is requested

- **GIVEN** Bilibili is installed
- **WHEN** the user runs `panerelay fetch --help`
- **THEN** the CLI shows raw fetch syntax, common options, and Bilibili in the installed-sites list

#### Scenario: Site help is requested

- **GIVEN** Bilibili is installed
- **WHEN** the user runs `panerelay fetch bilibili --help`
- **THEN** the CLI shows the installed adapter description and all installed Bilibili commands with arguments, output fields, and examples
- **AND** no browser connection is required

### Requirement: CLI invokes fetch adapters out of process

For an adapter command, the CLI SHALL select one live browser using the raw-fetch rules, validate command arguments against installed manifest metadata, and invoke the protected adapter executable out of process through a bounded correlated protocol. The CLI SHALL provide request-scoped Bridge connection material only to that process, suppress it from output and logs, enforce time and message-size bounds, preserve the adapter result, and terminate invocation if the browser generation changes. By default it SHALL render the result as an OpenCLI-style table using the manifest output-field order and an `<count> items · <seconds>s` footer. Matching OpenCLI, elapsed time SHALL start at the concrete command action before argument preparation and stop before rendering; `--json` SHALL instead print only the underlying structured result without changing adapter input or execution.

#### Scenario: Adapter command succeeds

- **GIVEN** a compatible installed adapter and one selected live browser
- **WHEN** the user runs `panerelay fetch <site> <command>` with valid arguments
- **THEN** the adapter can issue one or more browser fetches through the selected Bridge
- **AND** the CLI prints only the command result as a table in manifest output-field order

#### Scenario: Caller requests structured adapter output

- **GIVEN** an installed adapter command returns a structured result
- **WHEN** the user adds `--json`
- **THEN** the CLI prints that result as JSON
- **AND** `--json` is not forwarded as a site-command argument

#### Scenario: Installed executable is unsafe

- **GIVEN** an installed adapter entry is missing, symlinked, outside protected storage, permission-writable by other users, or inconsistent with its registry manifest
- **WHEN** the user requests a command
- **THEN** the CLI fails before reading Bridge credentials or starting the process

### Requirement: Built-in Bilibili adapter exposes fetch-compatible read operations

The built-in Bilibili adapter SHALL expose the read commands `whoami`, `me`, `video`, `search`, `hot`, `ranking`, `dynamic`, `feed`, `feed-detail`, `favorite`, `history`, `following`, `user-videos`, `comments`, `subtitle`, and `summary`. Their positional arguments, options, defaults, output-field order, pagination bounds, URL and short-link handling, WBI signing, envelope validation, and empty/authentication errors SHALL match the documented OpenCLI-compatible manifest contract. `favorite` SHALL be classified as read because its behavior issues only retrieval requests.

#### Scenario: Logged-in Bilibili user requests profile

- **GIVEN** the selected browser has a valid Bilibili session and Host Permission for the required Bilibili origins
- **WHEN** the user runs `panerelay fetch bilibili me`
- **THEN** the command returns the six documented profile fields
- **AND** it does not print session cookies, WBI keys, request signatures, or Bridge credentials

#### Scenario: User requests a signed multi-step read command

- **GIVEN** the selected browser has any required Bilibili session and Chrome Host Permission
- **WHEN** the user runs a command such as `comments`, `subtitle`, `summary`, `search`, or `user-videos`
- **THEN** the adapter resolves dependent identifiers, derives current WBI material when needed, and returns rows in the manifest's declared output-field order
- **AND** no request signature or Cookie value is printed

#### Scenario: Bilibili session is absent

- **GIVEN** the selected browser is not logged in to Bilibili
- **WHEN** the user runs `panerelay fetch bilibili me`
- **THEN** the adapter fails with an actionable authentication error
- **AND** it does not return a partial or anonymous profile as the current user

### Requirement: Built-in Bilibili adapter exposes guarded CSRF write operations

The built-in Bilibili adapter SHALL expose `comment`, `follow`, and `unfollow` as write commands. `comment` SHALL require a BVID-or-URL and message, support an optional positive parent reply ID, and require explicit `--execute`; `follow` and `unfollow` SHALL accept a UID, username, or Bilibili space URL, prevent self-targeting, check current relation state, perform an idempotent mutation when needed, and verify the resulting relation. Every mutation SHALL bind the target URL's applicable `bili_jct` Cookie to the `csrf` form field inside the Extension without returning its value.

#### Scenario: Caller omits the comment write guard

- **GIVEN** Bilibili is installed and the caller supplies a valid video and message
- **WHEN** the caller omits `--execute`
- **THEN** the adapter refuses before issuing a comment mutation

#### Scenario: Logged-in caller follows a user

- **GIVEN** the selected browser is logged in and is not already following the target
- **WHEN** the user runs `panerelay fetch bilibili follow <target>`
- **THEN** the adapter injects CSRF inside the Extension, performs the relation mutation, verifies the following state, and reports `followed`
- **AND** it does not print `bili_jct`, the generated Cookie header, or Bridge credentials

#### Scenario: CSRF Cookie is missing

- **GIVEN** the Bilibili session lacks an applicable `bili_jct` Cookie
- **WHEN** a Bilibili write command reaches mutation preparation
- **THEN** the request fails before network activity with an actionable authentication error
- **AND** no partial mutation result is returned

### Requirement: Built-in Bilibili adapter keeps browser-process operations unsupported

The Bilibili fetch adapter SHALL NOT expose OpenCLI `login` or `download`. Login requires foreground navigation and user interaction, while download requires browser Cookie export, streaming media, external downloader execution, and filesystem output beyond the browser-fetch contract.

#### Scenario: Caller requests an excluded Bilibili operation

- **GIVEN** the Bilibili fetch adapter is installed
- **WHEN** the caller requests `login` or `download`
- **THEN** the CLI reports an unknown Bilibili command from manifest metadata
- **AND** it does not navigate a tab, export Cookie values, invoke a downloader, or create a partial file

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
