## Purpose

Define the observable release identity, compatibility policy, documentation, and verification
gates for Panerelay's first stable `0.1.0` distribution.

## ADDED Requirements

### Requirement: Stable artifacts have one release identity

Panerelay SHALL assign the stable version `0.1.0` to every publishable package and expose the same
human-readable release identity in the Extension and retained candidate inventory.

#### Scenario: Stable candidate metadata is aligned

- **GIVEN** a maintainer prepares the first stable candidate
- **WHEN** release validation reads package, Extension, and release metadata
- **THEN** every distributable artifact identifies stable `0.1.0`

#### Scenario: Alpha or mismatched metadata remains

- **GIVEN** one package, internal dependency, Extension field, command example, or candidate entry
  still identifies an alpha or different version
- **WHEN** release validation runs
- **THEN** it fails before accepting the stable candidate

### Requirement: Stable Extension identity is consistent

Panerelay SHALL retain the Extension manifest's public `key`, derive its Chrome Extension ID during
release validation, and require that the official source and packaged Extension ID equal
`panplnkjlkoceaonlmpdekjphgmbggmi`. Setup SHALL also accept one user-configured Extension ID,
validate it before writing state, persist it as the effective installation identity, and use that
identity consistently in setup diagnostics, Bridge registration, and Native Messaging
`allowed_origins`. Panerelay SHALL NOT store or package a private signing key.

#### Scenario: Public key produces the official ID

- **GIVEN** the stable source or packaged Extension manifest contains its public `key`
- **WHEN** release validation derives the Chrome Extension ID
- **THEN** the result is `panplnkjlkoceaonlmpdekjphgmbggmi` and that ID remains the default
  installation identity

#### Scenario: User configures a custom Extension ID

- **GIVEN** the user supplies a syntactically valid 32-character Chrome Extension ID
- **WHEN** setup or update resolves the effective Extension identity
- **THEN** Panerelay persists the custom ID and writes exactly its
  `chrome-extension://<id>/` origin to each managed Native Messaging manifest

#### Scenario: Multiple Extension ID sources exist

- **GIVEN** command-line, environment, persisted, or official default identity sources overlap
- **WHEN** setup resolves the effective Extension ID
- **THEN** it uses command-line input first, then `PANERELAY_EXTENSION_ID`, then the persisted
  value, then the official default

#### Scenario: Update has no new Extension ID option

- **GIVEN** a prior setup persisted a custom Extension ID
- **WHEN** the user runs update without an explicit or environment override
- **THEN** Panerelay reuses the persisted ID instead of reverting to the official default

#### Scenario: Custom Extension ID is malformed

- **GIVEN** an Extension ID is not exactly 32 lowercase letters in the Chrome `a` through `p`
  alphabet
- **WHEN** setup, update, or doctor evaluates it
- **THEN** Panerelay rejects it before writing installation files or registry state

#### Scenario: Extension identity drifts

- **GIVEN** the configured effective Extension ID, Bridge registration, or Native Messaging origin
  no longer identifies the same Extension
- **WHEN** release or setup validation runs
- **THEN** it fails before installation or candidate acceptance and reports the inconsistent
  identity

#### Scenario: Private signing material is inspected

- **GIVEN** release validation inspects source and packaged artifacts
- **WHEN** it checks Extension identity material
- **THEN** it accepts only the public manifest key and finds no private signing key

### Requirement: Stable preparation remains non-publishing

Panerelay SHALL produce and validate inspectable npm tarballs, an unpacked-Extension archive,
checksums, and an inventory without publishing, tagging, uploading, or requiring release
credentials.

#### Scenario: Maintainer builds a stable candidate

- **GIVEN** the source tree passes normal quality checks
- **WHEN** the maintainer runs the stable candidate command
- **THEN** it writes the expected versioned artifacts and machine-readable integrity metadata
  without an external write

#### Scenario: CI checks release readiness

- **GIVEN** CI has no npm, GitHub, or Chrome Web Store publication credentials
- **WHEN** stable release validation runs
- **THEN** it completes every automated gate without attempting publication

### Requirement: Stable setup declares and diagnoses supported dependencies

Panerelay SHALL require Node.js 20 or newer and agent-browser 0.33.0 or newer, report detected
versions, and treat Qoder CLI as an optional Agent provider rather than a prerequisite for browser
automation or Codex conversations.

#### Scenario: agent-browser is below the supported minimum

- **GIVEN** setup detects an agent-browser version older than 0.33.0
- **WHEN** the user runs doctor
- **THEN** the agent-browser check fails with an actionable upgrade instruction

#### Scenario: Optional Qoder runtime is absent

- **GIVEN** Native Messaging, agent-browser, and Codex are otherwise ready
- **WHEN** Qoder CLI is not installed or does not expose compatible ACP capabilities
- **THEN** doctor and the side panel report Qoder as unavailable without making the complete
  Panerelay installation unhealthy

### Requirement: Provider selection is documented as configuration

Panerelay SHALL document explicit `--provider panerelay`, project-default, and user-default
agent-browser selection, including their precedence and their independence from browser
authorization.

#### Scenario: User does not change the default Provider

- **GIVEN** Panerelay is registered but is not the project or user default
- **WHEN** the user follows the stable documentation
- **THEN** the documented command explicitly selects `--provider panerelay`

#### Scenario: User chooses a default Provider scope

- **GIVEN** the user wants Panerelay selected without a command-line flag
- **WHEN** they follow the project or user setup command
- **THEN** documentation explains the affected configuration scope and states that no browser tab
  becomes authorized

### Requirement: Stable guidance distinguishes constraints from limitations

Panerelay SHALL describe daily-Chrome browser-process ownership as an architectural boundary,
bounded memory-only activity as a privacy and lifecycle design, and lockstep component versions as
a distribution compatibility rule.

#### Scenario: User evaluates browser-process behavior

- **GIVEN** a command requires isolated contexts, proxy or executable selection, profile replay,
  browser-wide close, or top-level request containment
- **WHEN** the user reads stable compatibility guidance
- **THEN** the command is identified as inherently unsupported through the Extension-backed
  provider and as failing closed

#### Scenario: User evaluates activity retention or component versions

- **GIVEN** the user needs to understand activity history or Extension/package compatibility
- **WHEN** they read stable operating guidance
- **THEN** the bounded retention and lockstep version rules are explained as intentional behavior
  with update and rollback steps

### Requirement: Stable acceptance covers every supported platform and adapter

Panerelay SHALL require automated packed-artifact checks on macOS, Linux, and Windows plus
representative real-runtime evidence for agent-browser 0.33.0, Codex, Qoder ACP, and Windows Native
Messaging before the stable candidate is declared releasable.

#### Scenario: A supported platform has no passing evidence

- **GIVEN** one supported operating system or required Agent adapter has not passed its defined
  acceptance gate
- **WHEN** maintainers review stable readiness
- **THEN** the candidate remains not ready and the missing evidence is identified

#### Scenario: All stable gates pass

- **GIVEN** source, packed-artifact, platform, Agent, browser, documentation, and integrity checks
  have passing evidence
- **WHEN** maintainers inspect the retained candidate
- **THEN** it is eligible for a separately authorized publication workflow
