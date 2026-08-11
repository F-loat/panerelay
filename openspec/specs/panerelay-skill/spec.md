# panerelay-skill Specification

## Purpose

Define one independently managed Agent Skill that is the single Agent entry point for Panerelay Fetch, routing, setup, verification, troubleshooting, and each supported browser automation engine.

## Requirements

### Requirement: One Skill covers every supported automation engine

Panerelay SHALL publish one discoverable `panerelay` Skill as its single Agent entry point. The Skill SHALL contain Panerelay Fetch and routing guidance plus scenario-specific instructions for agent-browser 0.33.0 or newer, Browser Use 0.13.7 or newer with a complete Browser Harness runtime, and Playwright CLI 0.1.17 or newer. It SHALL preserve each upstream engine's automation semantics, SHALL NOT claim that Panerelay directly provides DOM, navigation, or interaction commands, and SHALL use only Panerelay's documented Fetch, Provider, environment, or CDP connection surface.

#### Scenario: Agent receives an engine-specific browser task

- **GIVEN** the `panerelay` Skill is available to an Agent
- **WHEN** the user asks it to use agent-browser, Browser Use, or Playwright CLI with Panerelay
- **THEN** the Agent follows the matching engine workflow from the same Skill
- **AND** it does not substitute another engine without explaining the compatibility difference

### Requirement: Skill lifecycle is managed through the Agent Skills CLI

Documentation SHALL install the Skill from the repository using `npx skills add https://github.com/F-loat/panerelay --skill panerelay` and SHALL use the corresponding `npx skills` list, update, and remove operations for diagnosis and lifecycle management. `@panerelay/setup` SHALL NOT install, overwrite, remove, export, or diagnose the Skill.

#### Scenario: User installs Panerelay Agent guidance

- **GIVEN** the user has installed the Panerelay Extension
- **WHEN** they run the documented `npx skills add` command and select their Agent target and scope
- **THEN** the standard Agent Skills CLI installs `panerelay`
- **AND** setup does not need to know the Agent's Skill directory

#### Scenario: User uninstalls Panerelay setup

- **GIVEN** `panerelay` was installed through `npx skills`
- **WHEN** the user runs `npx --yes @panerelay/setup uninstall`
- **THEN** setup removes only Panerelay-owned host and automation-integration artifacts
- **AND** it leaves the independently managed Skill untouched

### Requirement: Skill drives a complete readiness workflow

The Skill SHALL inspect Node.js, the Extension connection, and only the automation engines requested by the user; install or repair missing supported upstream tools from their official sources with appropriate user consent; run setup for the selected Panerelay integration artifacts; stop for user-owned Extension installation and tab authorization; and report evidence from doctor plus an engine-specific authorized-tab check.

#### Scenario: Selected automation engine is missing

- **GIVEN** the user asks the Agent to configure one supported automation engine
- **WHEN** the Skill determines that its executable is missing or below the supported minimum
- **THEN** it identifies the official upstream installation source and the required version
- **AND** it does not change an unrelated engine, browser profile, shell startup file, or user default

#### Scenario: Browser authorization is required

- **GIVEN** the local integration is installed but the intended tab is not authorized
- **WHEN** readiness verification reaches the browser boundary
- **THEN** the Skill asks the user to install or open the Extension and authorize the intended scope
- **AND** it does not click authorization controls, infer permission from focus, or widen browser access

### Requirement: Skill troubleshooting covers both tool and Skill installation

The Skill SHALL provide actionable diagnosis for missing or unsupported agent-browser, Browser Use, Playwright CLI, incomplete Panerelay Provider/adapter installation, disconnected Extension state, missing or stale Skill installation, and incorrect engine-specific connection or default configuration.

#### Scenario: Agent cannot load the Skill or run the selected tool

- **GIVEN** a user reports that Panerelay browser automation is unavailable
- **WHEN** the Skill or documentation diagnoses the failure
- **THEN** it distinguishes Agent Skill discovery from automation-tool installation, Panerelay integration setup, Extension connection, and browser authorization
- **AND** it gives the smallest matching `npx skills`, upstream-tool, setup, doctor, or authorization action

### Requirement: Skill selects one engine without enumerating alternatives

For an ordinary browser task, the Skill SHALL select exactly one automation engine before it performs readiness checks. It SHALL use an engine explicitly named by the user, otherwise a trusted registered default, then registered agent-browser, Browser Use, or Playwright CLI in that order, and SHALL recommend agent-browser when no trusted setup registration exists. It MUST inspect, invoke, set up, and diagnose only the selected engine and MUST NOT probe every supported executable or ask the user to choose an engine merely because none was named.

#### Scenario: User names an engine

- **GIVEN** the user explicitly requests Browser Use, Playwright CLI, or agent-browser
- **WHEN** the Skill selects an integration for the task
- **THEN** it selects that engine and performs no availability or setup probe for either alternative

#### Scenario: Trusted setup registrations are available

- **GIVEN** the user does not name an engine and Panerelay supplies one or more cached setup registrations
- **WHEN** the Skill selects an integration for the task
- **THEN** it selects one registered default when present, otherwise the first registered engine in agent-browser, Browser Use, and Playwright CLI priority order
- **AND** it treats only that selected registration as the ordinary-task fast path

#### Scenario: No trusted setup registration is available

- **GIVEN** the user requests ordinary browser work without naming an engine and no trusted Panerelay setup registration is supplied
- **WHEN** the Skill begins readiness handling
- **THEN** it recommends and inspects only agent-browser
- **AND** a missing agent-browser executable leads to its targeted official installation path rather than probing Browser Use or Playwright CLI or asking the user to make an engine choice

#### Scenario: Selected registration is stale

- **GIVEN** the selected registered engine fails its first direct invocation or attach
- **WHEN** the Skill handles the stale hint
- **THEN** it runs only that engine's smallest matching diagnostic or repair
- **AND** it does not silently switch to another engine

### Requirement: Skill consumes conversation target hints without guessing

When a conversation context provides a versioned Panerelay browser/target hint, the Skill SHALL use the exact engine-specific session and target-selection values supplied with that context. It SHALL use agent-browser's injected `--session` and session-local `t1`, Browser Use's unchanged `switch_tab(targetId)`, or Playwright CLI's injected `-s=<session>` and target-scoped attach followed by index `0`. It MUST NOT select a target by URL/title when an exact hint is present and MUST stop with targeted diagnostics if the hint fails.

#### Scenario: Agent uses agent-browser target guidance

- **GIVEN** a conversation includes a valid agent-browser session value for an opaque target hint
- **WHEN** the Agent performs browser work with agent-browser
- **THEN** it uses that session consistently and verifies `t1` before taking a page action

#### Scenario: Agent uses Browser Use target guidance

- **GIVEN** a conversation includes an opaque Browser Use target ID
- **WHEN** the Agent performs browser work with Browser Use
- **THEN** it calls `switch_tab` with that exact target ID before page helpers
- **AND** it keeps the existing shared Panerelay daemon lane

#### Scenario: Agent uses Playwright target guidance

- **GIVEN** a conversation includes a Playwright session and target-scoped attach URL
- **WHEN** the Agent performs browser work with Playwright CLI
- **THEN** it attaches in that session, verifies the intended page at index `0`, and selects index `0` before page actions

#### Scenario: Exact hint fails

- **GIVEN** any engine reports that the injected session, target ID, or target-scoped endpoint is stale or unavailable
- **WHEN** the Skill handles the failure
- **THEN** it reports the smallest target or authorization diagnostic
- **AND** it does not guess from matching URL/title, widen authorization, switch browsers, or silently use another engine

### Requirement: Skill separates authenticated fetch from page automation

The `panerelay` Skill SHALL be the single Panerelay Agent entry point and use Panerelay Fetch MCP for HTTP(S) requests that need the user's existing browser login state when that tool is available. It SHALL continue to use the selected agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, or Playwright CLI 0.1.17 workflow for DOM inspection, navigation, interaction, downloads, and other browser automation. It SHALL NOT ask for API keys, claim that Panerelay directly implements browser automation, or claim that Panerelay intercepts native Agent web tools.

#### Scenario: Task needs only authenticated JSON

- **GIVEN** the Panerelay Fetch MCP tool is available and the domain is user-authorized
- **WHEN** an Agent needs an authenticated JSON endpoint without page interaction
- **THEN** the Skill uses the Fetch MCP tool
- **AND** it does not create an automation control lease

#### Scenario: Task needs page state or navigation

- **GIVEN** the task requires DOM, navigation, interaction, or a browser-process feature
- **WHEN** the Skill chooses a tool path
- **THEN** it uses the already selected supported automation engine
- **AND** it does not misrepresent Fetch MCP as page automation
