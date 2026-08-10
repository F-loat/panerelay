# site-adapter-development Specification

## Purpose

Define a lightweight, reusable source-authoring and validation workflow that produces Panerelay's strict installed fetch-adapter artifacts without requiring each site to become an npm package.

## Requirements

### Requirement: Source adapters use a command-per-file layout

A source adapter SHALL declare bounded site metadata in one conventional site definition and SHALL place each public command in one matching source module. Command modules SHALL colocate their help metadata and handler, MAY import shared relative modules, and SHALL NOT require a handwritten installed manifest, adapter protocol entrypoint, package manifest, TypeScript configuration, or build script.

#### Scenario: Author creates a source adapter

- **GIVEN** an author wants to add a site with two commands
- **WHEN** they create the conventional site definition and two command modules
- **THEN** site tooling discovers exactly those two commands and their declared metadata
- **AND** the source directory contains no generated manifest or executable bundle

#### Scenario: Source layout is ambiguous

- **GIVEN** a source directory has duplicate command IDs, unsafe paths, non-literal metadata, an unsupported import, or an unknown public source file
- **WHEN** site tooling validates it
- **THEN** validation fails with the affected source path and field
- **AND** no install artifact is produced

### Requirement: Site tooling scaffolds and checks adapters without project boilerplate

The public site toolkit SHALL provide `init`, `check`, `test`, and `build` operations. `init` SHALL create a minimal command-per-file adapter; `check` SHALL validate source shape, metadata, imports, types, and generated protocol compatibility without retaining output; `test` SHALL run only when explicitly requested by the author; and `build` SHALL write one strict install-source directory containing only the generated manifest and self-contained entry.

#### Scenario: Author starts a new adapter

- **GIVEN** an empty target directory
- **WHEN** the author runs the toolkit's `init` operation with a valid site ID
- **THEN** it creates a minimal site definition, one example command, and concise development instructions
- **AND** it does not create a nested npm package or install dependencies

#### Scenario: Author checks a valid adapter

- **GIVEN** a valid source adapter has no prior build output
- **WHEN** the author runs `check`
- **THEN** the toolkit validates the same source and generated contract used by setup
- **AND** it leaves no install artifact in the source directory

#### Scenario: Author explicitly runs tests

- **GIVEN** the source adapter contains colocated tests
- **WHEN** the author runs `test`
- **THEN** the toolkit executes those tests in a bounded child process and reports their exit status
- **AND** setup never invokes those tests during installation

### Requirement: Source builds are deterministic and do not execute repository setup code

For the same toolkit version and source bytes, `build` SHALL produce equivalent normalized manifest metadata and executable behavior. The build SHALL bundle only the declared source graph and toolkit runtime, SHALL reject unresolved or undeclared package imports, and SHALL NOT run an adapter module to discover metadata, install dependencies, or invoke repository lifecycle or custom build scripts.

#### Scenario: Source imports an undeclared package

- **GIVEN** a command imports a third-party package that is not part of the site-toolkit contract
- **WHEN** the source is checked or built
- **THEN** the operation fails before executing adapter code
- **AND** it does not run a package manager to resolve the import

#### Scenario: Repository contains lifecycle scripts

- **GIVEN** a source repository also contains a package manifest with install, prepare, or build scripts
- **WHEN** the toolkit builds the adapter source
- **THEN** those scripts are ignored and never executed
- **AND** the output depends only on the declared adapter source graph and toolkit runtime

### Requirement: Built-in and external adapters share one source contract

The aggregate built-in site catalog SHALL build its site directories through the public site-toolkit contract. Built-in adapters MAY keep site-specific helpers and tests, but SHALL NOT use a private manifest generator or executable entrypoint that external authors cannot use.

#### Scenario: Built-in Bilibili is built

- **GIVEN** Bilibili remains a source directory in the aggregate site catalog
- **WHEN** the workspace and packed catalog builds run
- **THEN** they use the public toolkit to generate Bilibili's manifest and self-contained entry
- **AND** the resulting install source remains compatible with setup and the Panerelay CLI

### Requirement: Site toolkit exposes bounded response and session helpers

The public site toolkit SHALL expose helpers that decode a Base64 browser-fetch response into bounded bytes or text using an explicitly selected supported character encoding, seed a bounded same-origin page request while preserving caller-supplied source headers, validate JSON transport and HTTP status, and report normalized typed site-command failures. These helpers SHALL execute only through the provided `SiteCommandContext.fetch` function and SHALL NOT navigate or evaluate a browser tab.

#### Scenario: Adapter decodes GBK response bytes

- **GIVEN** browser fetch returned a Base64 body containing valid GBK bytes
- **WHEN** the command decodes it as GBK through the toolkit
- **THEN** it receives the expected Unicode text within the response-size bound

#### Scenario: Seeded JSON request requires authentication

- **GIVEN** a command seeds one same-origin page and its subsequent JSON request returns an authentication status
- **WHEN** the helper validates the response
- **THEN** it throws a normalized authentication-required failure
- **AND** it does not retry a write, execute page JavaScript, or acquire browser control

### Requirement: Site toolkit exposes invocation artifacts and multipart construction

The public site toolkit SHALL let a command retrieve a declared one-shot file artifact by argument name and build one bounded multipart request body from that artifact and bounded text fields. Source checking and generated runtime behavior SHALL use the same artifact limits and SHALL reject unsupported or ambiguous input before network execution.

#### Scenario: External source adapter uses a file argument

- **GIVEN** an external source adapter declares one file argument and uses the public artifact and multipart helpers
- **WHEN** site tooling checks and builds it
- **THEN** the generated two-file installation preserves the file metadata and runtime behavior
- **AND** it requires no private Panerelay import, custom build plugin, or package dependency

### Requirement: Site toolkit normalizes command failures

The public site toolkit SHALL provide a typed error with a bounded stable code, message, and retryable state. Generated adapters SHALL serialize typed failures structurally and SHALL normalize ordinary thrown errors to a generic command-failed code without exposing Bridge connection material, artifact bytes, or local paths.

#### Scenario: Command throws a typed challenge error

- **GIVEN** an adapter detects an upstream verification page
- **WHEN** it throws the toolkit's challenge-required error
- **THEN** the generated adapter returns the challenge code, bounded message, and retryable state

#### Scenario: Command throws an ordinary error

- **GIVEN** an adapter throws an ordinary Error
- **WHEN** the generated runtime serializes the failure
- **THEN** it uses the generic command-failed code and bounded message
- **AND** the response remains valid for the installed adapter protocol
