# stable-distribution Specification

## Purpose

Define the observable release identity, compatibility policy, documentation, and verification gates for Panerelay stable distributions.

## Requirements

### Requirement: Stable artifacts have one release identity

Panerelay SHALL keep the repository's plain semantic version authoritative for stable releases. Stable candidates SHALL use that version across every publishable package, the Extension `version_name`, and retained inventory. An explicitly selected beta workflow SHALL instead derive one unique prerelease version from the repository version and workflow run identity and apply it consistently only in the temporary runner workspace.

#### Scenario: Stable candidate metadata is aligned

- **GIVEN** a maintainer prepares a stable candidate
- **WHEN** release validation reads package, Extension, and release metadata
- **THEN** every distributable artifact identifies the repository's plain semantic version

#### Scenario: Alpha or mismatched metadata remains

- **GIVEN** one package, internal dependency, Extension field, command example, or candidate entry still identifies an alpha or different version
- **WHEN** release validation runs
- **THEN** it fails before accepting the stable candidate

#### Scenario: Beta candidate metadata is aligned

- **GIVEN** a maintainer dispatches the beta publication workflow
- **WHEN** release validation reads the temporarily prepared package, Extension, and release metadata
- **THEN** every distributable artifact identifies the same derived beta version
- **AND** the repository source version remains unchanged after preparation

#### Scenario: Channel or lockstep metadata drifts

- **GIVEN** one package, Extension field, candidate entry, or selected channel does not match the expected release identity
- **WHEN** release validation runs
- **THEN** it fails before accepting or publishing the candidate

### Requirement: Stable Extension identity is consistent

Panerelay SHALL retain the Extension manifest's public `key`, derive its Chrome Extension ID during release validation, and require that the official source and packaged Extension ID equal `panplnkjlkoceaonlmpdekjphgmbggmi`. Setup SHALL also accept one user-configured Extension ID, validate it before writing state, persist it as the effective installation identity, and use that identity consistently in setup diagnostics, Bridge registration, and Native Messaging `allowed_origins`. Panerelay SHALL NOT store or package a private signing key.

#### Scenario: Public key produces the official ID

- **GIVEN** the stable source or packaged Extension manifest contains its public `key`
- **WHEN** release validation derives the Chrome Extension ID
- **THEN** the result is `panplnkjlkoceaonlmpdekjphgmbggmi` and that ID remains the default installation identity

#### Scenario: User configures a custom Extension ID

- **GIVEN** the user supplies a syntactically valid 32-character Chrome Extension ID
- **WHEN** setup or update resolves the effective Extension identity
- **THEN** Panerelay persists the custom ID and writes exactly its `chrome-extension://<id>/` origin to each managed Native Messaging manifest

#### Scenario: Multiple Extension ID sources exist

- **GIVEN** command-line, environment, persisted, or official default identity sources overlap
- **WHEN** setup resolves the effective Extension ID
- **THEN** it uses command-line input first, then `PANERELAY_EXTENSION_ID`, then the persisted value, then the official default

#### Scenario: Update has no new Extension ID option

- **GIVEN** a prior setup persisted a custom Extension ID
- **WHEN** the user runs update without an explicit or environment override
- **THEN** Panerelay reuses the persisted ID instead of reverting to the official default

#### Scenario: Custom Extension ID is malformed

- **GIVEN** an Extension ID is not exactly 32 lowercase letters in the Chrome `a` through `p` alphabet
- **WHEN** setup, update, or doctor evaluates it
- **THEN** Panerelay rejects it before writing installation files or registry state

#### Scenario: Extension identity drifts

- **GIVEN** the configured effective Extension ID, Bridge registration, or Native Messaging origin no longer identifies the same Extension
- **WHEN** release or setup validation runs
- **THEN** it fails before installation or candidate acceptance and reports the inconsistent identity

#### Scenario: Private signing material is inspected

- **GIVEN** release validation inspects source and packaged artifacts
- **WHEN** it checks Extension identity material
- **THEN** it accepts only the public manifest key and finds no private signing key

### Requirement: Stable preparation remains non-publishing

Panerelay SHALL produce and validate inspectable npm tarballs, an unpacked-Extension archive, checksums, and an inventory without publishing, tagging, uploading, or requiring release credentials.

#### Scenario: Maintainer builds a stable candidate

- **GIVEN** the source tree passes normal quality checks
- **WHEN** the maintainer runs the stable candidate command
- **THEN** it writes the expected versioned artifacts and machine-readable integrity metadata without an external write

#### Scenario: CI checks release readiness

- **GIVEN** CI has no npm, GitHub, or Chrome Web Store publication credentials
- **WHEN** stable release validation runs
- **THEN** it completes every automated gate without attempting publication

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
- **THEN** the localized completion output directs the user to load the matching custom Extension build
- **AND** it does not direct that custom installation to the official Store build

#### Scenario: Developer works with an unpublished build

- **GIVEN** a developer is running or validating a workspace build in Chrome or Edge
- **WHEN** they follow development or candidate-verification guidance
- **THEN** the documentation retains the shared unpacked Chromium Extension path and clearly scopes it to that non-default workflow

#### Scenario: User operates a self-built or rollback distribution

- **GIVEN** a user intentionally uses a self-built Extension or rolls back the lockstep installation
- **WHEN** they follow the exceptional installation guidance
- **THEN** the documentation allows a matching unpacked Chromium Extension and setup package without presenting it as the normal official installation path

### Requirement: Provider selection is documented as opt-in configuration

Panerelay SHALL install the agent-browser Provider only when setup receives `--agent-browser`, including the bounded setup-backed operation initiated by an explicit Extension settings click. Agent Skills SHALL be distributed independently from setup through the repository-level `panerelay` Skill and managed with `npx skills`. Explicit `--provider panerelay` and user-default agent-browser selection controls SHALL remain independent from browser authorization. User-level setup options SHALL require an explicit applicable integration selection. Documentation SHALL identify Extension settings as an additional way to install a missing automation integration and set or clear its user-level default while the Native Host is connected. Panerelay-owned Codex and Claude Code Providers SHALL include the built-in Panerelay Fetch MCP routing without changing external Agent configuration; persistent external Codex or Claude configuration SHALL require the separate explicit Agent fetch selection.

#### Scenario: User follows the default setup path

- **GIVEN** neither automation integration nor external Agent fetch integration has been selected
- **WHEN** the user runs `npx --yes @panerelay/setup`
- **THEN** setup installs the Native Host without probing automation engines, writing external Agent MCP configuration, installing an automation Provider, or managing an Agent Skill
- **AND** Panerelay-owned Codex and Claude Code side-panel Providers may use only the built-in Panerelay Fetch MCP routing
- **AND** it does not change a user-level automation default

#### Scenario: User explicitly installs agent-browser support

- **GIVEN** agent-browser 0.33.0 or newer is available
- **WHEN** the user runs `npx --yes @panerelay/setup --agent-browser`
- **THEN** setup validates agent-browser and installs the Panerelay Provider registration
- **AND** it does not install, update, remove, or diagnose any Agent Skill
- **AND** it does not change external Codex or Claude Code MCP configuration
- **AND** the documented verification command explicitly selects `--provider panerelay` unless the user also selected the user default

#### Scenario: User chooses the user default through setup

- **GIVEN** the user wants Panerelay selected without a command-line Provider or environment override
- **WHEN** they select agent-browser and/or Browser Use with `--global-default`
- **THEN** documentation explains the affected user-level configuration and states that no browser tab becomes authorized
- **AND** Playwright and Agent fetch routing remain outside that default selection

#### Scenario: User omits an explicit default-capable integration

- **GIVEN** the user invokes `--global-default` without `--agent-browser` or `--browser-use`
- **WHEN** setup validates the invocation
- **THEN** setup fails with guidance to add a default-capable integration
- **AND** it does not install an integration or modify Provider configuration

#### Scenario: User manages an integration in the Extension

- **GIVEN** the Native Host is connected
- **WHEN** the user uses Extension settings for an installed or missing automation integration
- **THEN** documentation explains that the action may run the matching explicit setup operation before setting or clearing its user-level default
- **AND** it does not install an Agent Skill, change external Agent fetch routing, uninstall Panerelay, or grant browser authorization

### Requirement: Stable repository exposes one independently installable Skill

The stable source repository SHALL expose exactly one public Panerelay browser-automation Skill in a standard `npx skills` discovery path. Release validation SHALL verify its frontmatter, three supported engine workflows, independent installation command, and absence from the packed `@panerelay/setup` artifact.

#### Scenario: Stable artifacts are inspected

- **GIVEN** a stable or beta candidate is prepared
- **WHEN** release validation inspects the repository and packed setup package
- **THEN** the repository exposes `panerelay` to `npx skills`
- **AND** the packed setup package contains no bundled Agent Skill or Skill lifecycle module

### Requirement: Beta package versions use one public ordinal

Panerelay SHALL generate beta npm versions as `X.Y.Z-beta.<run-number>`. A retry of the same GitHub Actions workflow run SHALL reuse that npm version, while the next workflow run SHALL advance to the next beta ordinal. Temporary beta metadata SHALL continue to be restored without modifying the repository.

#### Scenario: A new beta workflow run is prepared

- **GIVEN** the repository version is stable base `X.Y.Z`
- **WHEN** release workflow run number `N` prepares the beta candidate
- **THEN** every publishable package uses version `X.Y.Z-beta.N`

#### Scenario: A beta workflow run is retried

- **GIVEN** workflow run number `N` is retried with a higher run-attempt value
- **WHEN** the beta candidate is prepared again
- **THEN** the npm package version remains `X.Y.Z-beta.N`

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

### Requirement: Stable distribution includes the public site toolkit

Panerelay SHALL publish `@panerelay/site-kit` with the same lockstep stable or beta version as the protocol, sites catalog, setup, and CLI packages. Release validation SHALL inspect its public API, executable help/version behavior, minimal scaffold, source check, deterministic two-file build, packed contents, and consumption from an isolated project without workspace links.

#### Scenario: Stable candidate contains site tooling

- **GIVEN** a stable or beta candidate is prepared
- **WHEN** release validation inspects package identities and retained tarballs
- **THEN** site-kit has the same selected release version and dependency identities as the other lockstep packages
- **AND** its packed artifact contains only documented runtime, types, metadata, README, and license content

#### Scenario: Packed author workflow is exercised

- **GIVEN** release validation installs the retained site-kit tarball in an isolated project
- **WHEN** it scaffolds, checks, and builds the minimal adapter
- **THEN** the generated manifest and entry pass the public adapter protocol validation
- **AND** the workflow does not depend on Panerelay workspace source or generated workspace output

### Requirement: Stable distribution includes the Fetch MCP entrypoint

Stable and beta Native Host artifacts SHALL include the same-version Fetch MCP mode and setup SHALL reference the stable launcher rather than a version directory for persistent Agent configuration. Release validation SHALL exercise the MCP initialize, tools/list, successful bounded fetch, denial, disconnect, and cleanup paths without retaining response bodies or credentials. The agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17 baselines SHALL remain unchanged.

#### Scenario: Candidate artifacts are verified

- **GIVEN** a lockstep candidate Native Host and setup package were prepared
- **WHEN** release validation inspects and exercises Agent fetch routing
- **THEN** the stable launcher starts the candidate Fetch MCP server and its version matches the Extension
- **AND** existing automation-engine compatibility groups pass without a capability reclassification caused only by this fetch tool
