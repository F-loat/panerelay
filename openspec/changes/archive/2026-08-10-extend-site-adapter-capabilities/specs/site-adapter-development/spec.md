## ADDED Requirements

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
