## Purpose

Define explicit bounded local-file inputs and multipart request construction for site adapters while preventing implicit path access, directory transfer, and automatic local-file output.

## ADDED Requirements

### Requirement: Commands may declare one bounded file argument

A fetch-adapter command MAY declare at most one argument with type `file`. The CLI SHALL resolve only the path explicitly supplied for that argument, SHALL require a non-symlink regular file, SHALL enforce a 12 MiB file-size bound before reading it, and SHALL reject directories, devices, sockets, missing files, and files that change identity during the bounded read.

#### Scenario: User supplies a valid PDF

- **GIVEN** an installed command declares one required file argument
- **WHEN** the user supplies a readable 10 MiB regular PDF path
- **THEN** the CLI prepares one invocation artifact containing bounded bytes and safe metadata
- **AND** it does not inspect sibling files or directories

#### Scenario: User supplies a symbolic link

- **GIVEN** a file argument resolves to a symbolic link
- **WHEN** the CLI prepares the invocation
- **THEN** it rejects the argument before browser selection or adapter execution

#### Scenario: File exceeds the bound

- **GIVEN** the selected regular file is larger than 12 MiB
- **WHEN** the CLI prepares the invocation
- **THEN** it rejects the input without reading or sending the complete file

### Requirement: Invocation artifacts hide local paths

The adapter invocation protocol SHALL carry each accepted file as a bounded one-shot artifact containing an opaque argument ID, safe basename, media type, decoded size, and Base64 bytes. The adapter child SHALL receive no absolute or relative local path for the file and SHALL access it only through the invocation context for that command.

#### Scenario: Adapter reads an invocation artifact

- **GIVEN** the CLI accepted a file argument
- **WHEN** the adapter command requests that argument's artifact
- **THEN** it receives the declared basename, media type, size, and exact bytes
- **AND** it cannot derive the original directory from adapter input

#### Scenario: Adapter requests an undeclared artifact

- **GIVEN** no accepted file argument exists with the requested name
- **WHEN** a command requests that artifact
- **THEN** the site toolkit returns a typed invalid-input failure

### Requirement: Site tooling constructs bounded multipart bodies

The public site toolkit SHALL construct a standards-compliant multipart body from bounded UTF-8 fields and invocation artifacts, SHALL return the matching `Content-Type` value and Base64 request body, and SHALL reject duplicate unsafe field names, CR/LF filename injection, more than one file part, or a resulting decoded request body larger than 16 MiB.

#### Scenario: Adapter builds a multipart upload

- **GIVEN** one accepted PDF artifact and bounded text fields
- **WHEN** the command builds a multipart request
- **THEN** each field and file is encoded once with a matching boundary and safe disposition metadata
- **AND** the resulting body can be issued through ordinary browser fetch

#### Scenario: Multipart body exceeds the transport bound

- **GIVEN** artifact and field bytes would exceed the decoded request-body limit
- **WHEN** the adapter builds the multipart body
- **THEN** construction fails before browser network activity

### Requirement: File support does not create a download manager

Site-adapter artifacts SHALL be invocation inputs only in this version. Commands MAY continue to return bounded inline Base64 or remote resource URLs, but SHALL NOT request arbitrary local output paths, write directories, perform background or batch download management, or retain invocation artifact bytes after the one-shot child exits.

#### Scenario: Command returns a remote download URL

- **GIVEN** an adapter discovers a downloadable resource
- **WHEN** it returns the command result
- **THEN** it may return a bounded URL or existing inline Base64 field
- **AND** Panerelay does not create a local file implicitly
