## MODIFIED Requirements

### Requirement: Official Extension installation is Store-first

Panerelay SHALL direct normal Chrome and Edge users to install the official Chromium Extension from its Chrome Web Store listing when their browser permits that listing. Documentation SHALL reserve unpacked Extension loading for workspace development, self-built distributions, rollback, explicit candidate verification, and Edge installations that cannot use the listing, and SHALL pair the official Store Extension with the normal setup command without embedding a Panerelay release number in permanent installation guidance. Successful setup output SHALL present the Store listing when configured for the official Extension ID and SHALL instead direct custom-ID users to load their matching Extension build.

#### Scenario: Chrome or Edge user follows the normal installation path

- **GIVEN** a Chrome or Edge user wants the official Panerelay distribution
- **WHEN** they follow the English or Chinese quickstart or setup guidance
- **THEN** the first Extension installation step links to the official Chrome Web Store listing
- **AND** the local integration step uses the unversioned setup command

#### Scenario: Official setup completes

- **GIVEN** setup resolves the official Panerelay Extension ID
- **WHEN** local integration installation succeeds
- **THEN** the localized completion output prints the official Chrome Web Store listing as the Extension next step

#### Scenario: Custom-ID setup completes

- **GIVEN** setup resolves a custom Extension ID
- **WHEN** local integration installation succeeds
- **THEN** the localized completion output directs the user to load the matching custom Chromium Extension build
- **AND** it does not direct that custom installation to the official Store build

#### Scenario: Developer works with an unpublished build

- **GIVEN** a developer is running or validating a workspace build in Chrome or Edge
- **WHEN** they follow development or candidate-verification guidance
- **THEN** the documentation retains the shared unpacked Chromium Extension path and clearly scopes it to that non-default workflow

#### Scenario: User operates a self-built or rollback distribution

- **GIVEN** a user intentionally uses a self-built Extension or rolls back the lockstep installation
- **WHEN** they follow the exceptional installation guidance
- **THEN** the documentation allows a matching unpacked Chromium Extension and setup package without presenting it as the normal official installation path

### Requirement: Stable guidance distinguishes constraints from limitations

Panerelay SHALL describe daily-Chromium browser-process ownership in Chrome and Edge as an architectural boundary, bounded memory-only activity as a privacy and lifecycle design, and lockstep component versions as a distribution compatibility rule.

#### Scenario: User evaluates browser-process behavior

- **GIVEN** a command requires isolated contexts, proxy or executable selection, profile replay, browser-wide close, or top-level request containment
- **WHEN** the user reads stable compatibility guidance for Chrome or Edge
- **THEN** the command is identified as inherently unsupported through the Extension-backed provider and as failing closed

#### Scenario: User evaluates activity retention or component versions

- **GIVEN** the user needs to understand activity history or Extension/package compatibility
- **WHEN** they read stable operating guidance
- **THEN** the bounded retention and lockstep version rules are explained as intentional behavior with update and rollback steps

### Requirement: Stable acceptance covers every supported platform and adapter

Panerelay SHALL require automated packed-artifact checks on macOS, Linux, and Windows plus representative real-runtime evidence for Chrome, Edge, agent-browser 0.33.0, Codex, Qoder ACP, and Windows Native Messaging before the stable candidate is declared releasable. Shared Chromium automation coverage SHALL NOT by itself classify Edge as `Verified`.

#### Scenario: A supported platform, browser, or adapter has no passing evidence

- **GIVEN** one supported operating system, browser runtime, or required Agent adapter has not passed its defined acceptance gate
- **WHEN** maintainers review stable readiness
- **THEN** the candidate remains not ready and the missing evidence is identified

#### Scenario: All stable gates pass

- **GIVEN** source, packed-artifact, platform, Agent, Chrome, Edge, documentation, and integrity checks have passing evidence
- **WHEN** maintainers inspect the retained candidate
- **THEN** it is eligible for a separately authorized publication workflow
