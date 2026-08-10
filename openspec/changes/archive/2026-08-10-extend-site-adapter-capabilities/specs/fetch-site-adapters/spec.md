## MODIFIED Requirements

### Requirement: Fetch adapters use a versioned installable format

A fetch site adapter SHALL consist of a strict versioned manifest and one self-contained executable entry artifact. The manifest SHALL declare an adapter ID, display name, version, description, protocol version, executable entry, and bounded command metadata including each command's name, description, access classification, arguments, output fields, and examples. Command arguments MAY use string, number, boolean, or file types, but one command SHALL declare at most one file argument. Adapter, command, and argument identifiers SHALL be lowercase, bounded, and unique within their scope. The manifest and invocation protocol SHALL NOT declare user-managed profiles or site API secrets.

#### Scenario: Local adapter directory is valid

- **GIVEN** a local directory contains the expected manifest and self-contained entry artifact
- **WHEN** setup validates the directory
- **THEN** setup accepts only declared safe relative paths and well-formed metadata
- **AND** it does not execute adapter code during validation or installation

#### Scenario: Adapter format is invalid

- **GIVEN** an adapter has an unknown protocol, unsafe path, symlink, duplicate command, user-managed credential metadata, multiple file arguments in one command, undeclared file, oversized artifact, or malformed metadata
- **WHEN** setup evaluates it
- **THEN** setup rejects that adapter before changing its active installation

### Requirement: CLI invokes fetch adapters out of process

For an adapter command, the CLI SHALL validate command arguments and any explicit file input, select one live browser using the raw-fetch rules, and invoke the protected adapter executable out of process through a bounded correlated protocol. The CLI SHALL provide only request-scoped Bridge connection material and bounded invocation artifacts to that process. It SHALL NOT accept, persist, select, or inject user-supplied site API keys, PATs, bearer tokens, refresh tokens, or client secrets for an adapter. The CLI SHALL enforce time and message-size bounds, preserve successful adapter results, preserve bounded structured command-error codes, and terminate invocation if the browser generation changes. By default it SHALL render the result as an OpenCLI-style table using the manifest output-field order and an `<count> items · <seconds>s` footer. Matching OpenCLI, elapsed time SHALL start at the concrete command action before argument preparation and stop before rendering; `--json` SHALL instead print only the underlying structured result without changing adapter input or execution.

#### Scenario: Adapter command succeeds with a file

- **GIVEN** a compatible installed adapter, one accepted file argument, and one selected live browser
- **WHEN** the user runs the command
- **THEN** the adapter can access the one-shot artifact and issue one or more browser fetches through the selected Bridge
- **AND** the local path does not appear in adapter input or output

#### Scenario: Adapter requests a user-managed API key

- **GIVEN** a site requires an API key, PAT, bearer token, refresh token, or client secret supplied outside the browser login state
- **WHEN** its adapter manifest or invocation attempts to declare that credential
- **THEN** Panerelay rejects the unsupported metadata or input
- **AND** it does not create protected adapter credential state

#### Scenario: Caller requests structured adapter output

- **GIVEN** an installed adapter command returns a structured result
- **WHEN** the user adds `--json`
- **THEN** the CLI prints that result as JSON
- **AND** `--json` and `--browser` are not forwarded as site-command arguments

#### Scenario: Adapter returns a typed failure

- **GIVEN** a command reports a bounded authentication, challenge, upstream, response-shape, empty-result, invalid-input, or generic command failure
- **WHEN** the adapter child completes unsuccessfully
- **THEN** the CLI preserves its normalized code, message, and retryable state for diagnostics
- **AND** no Bridge token, file bytes, or local path is included

#### Scenario: Installed executable is unsafe

- **GIVEN** an installed adapter entry is missing, symlinked, outside protected storage, permission-writable by other users, or inconsistent with its registry manifest
- **WHEN** the user requests a command
- **THEN** the CLI fails before reading Bridge credentials or file bytes and before starting the process

## ADDED Requirements

### Requirement: Site E2E cases declare authentication expectations

The built-in site E2E inventory SHALL classify each representative case as public, optionally authenticated, or authentication-required and MAY declare a bounded expected blocker category. E2E output and compatibility records SHALL distinguish authentication, challenge, upstream, response-shape, and empty-result failures without retaining response bodies, cookies, file bytes, screenshots, or machine-specific paths.

#### Scenario: Required-login case lacks its session

- **GIVEN** a representative E2E case is marked authentication-required
- **WHEN** it fails with a normalized authentication error
- **THEN** the result is recorded as blocked by authentication rather than as an unknown parser failure
- **AND** no credential data is retained
