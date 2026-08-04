## MODIFIED Requirements

### Requirement: Stable setup declares and diagnoses supported dependencies

Panerelay SHALL require Node.js 20 or newer for every installation. The default setup and doctor paths SHALL treat agent-browser, Browser Use, and Playwright CLI as optional automation integrations. When explicitly selected, Panerelay SHALL require agent-browser 0.33.0 or newer, Browser Use 0.13.7 or newer, or `@playwright/cli` 0.1.17 or newer, report the selected engine's detected version, and keep each pinned compatibility baseline. Claude Code, Qoder CLI, and OpenCode SHALL remain optional Agent providers rather than prerequisites for the Native Host or other integrations. Setup and doctor SHALL report a detected OpenCode version separately from its capability-negotiated runtime readiness.

#### Scenario: Default setup has no automation-engine prerequisite

- **GIVEN** Node.js is supported and none of the optional automation engines is installed
- **WHEN** the user runs base setup or its default doctor command
- **THEN** the Native Host installation can be healthy without an automation-engine dependency check

#### Scenario: Explicit Playwright integration is below the supported minimum

- **GIVEN** the user selects Playwright and setup detects `@playwright/cli` below 0.1.17 or unavailable
- **WHEN** setup or `doctor --playwright` evaluates the integration
- **THEN** the Playwright check fails with an actionable install or upgrade instruction

#### Scenario: Optional agent runtimes are absent

- **GIVEN** Native Messaging and Codex are otherwise ready
- **WHEN** Claude Code, Qoder CLI, or OpenCode is absent or incompatible
- **THEN** doctor and the Side Panel report that provider as unavailable without making the Native Host or selected automation integrations unhealthy

#### Scenario: OpenCode version is detected but ACP is incompatible

- **GIVEN** an `opencode` executable reports a version but cannot negotiate the required ACP v1 session behavior
- **WHEN** setup, doctor, or provider preparation evaluates it
- **THEN** Panerelay reports the detected executable separately from the incompatible Agent provider state
- **AND** it does not classify that version as verified

### Requirement: Stable acceptance covers every supported platform and adapter

Panerelay SHALL require automated packed-artifact checks on macOS, Linux, and Windows plus representative real-runtime evidence for Chrome, Edge, agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, Playwright CLI 0.1.17, Codex, Qoder ACP, OpenCode 1.18.12 ACP, and Windows Native Messaging before the stable candidate is declared releasable. Shared Chromium automation coverage SHALL NOT by itself classify Edge as `Verified`, and static OpenCode source or protocol inspection SHALL NOT by itself classify the runtime as `Verified`.

#### Scenario: A supported platform, browser, or adapter has no passing evidence

- **GIVEN** one supported operating system, browser runtime, or required Agent or automation adapter has not passed its defined acceptance gate
- **WHEN** maintainers review stable readiness
- **THEN** the candidate remains not ready and the missing evidence is identified

#### Scenario: OpenCode runtime evidence is missing

- **GIVEN** OpenCode's documented ACP surface and source contract match Panerelay but no real OpenCode 1.18.12 subprocess has passed the recorded acceptance flow
- **WHEN** maintainers review the compatibility record
- **THEN** OpenCode remains `Forwarded` or `Partial` rather than `Verified`

#### Scenario: All stable gates pass

- **GIVEN** every required packed-artifact, platform, browser, Agent, and automation-engine gate has passing evidence
- **WHEN** maintainers review the release candidate
- **THEN** the candidate may be declared ready subject to the existing release and publication controls
