## MODIFIED Requirements

### Requirement: Stable setup declares and diagnoses supported dependencies

Panerelay SHALL require Node.js 20 or newer for every installation. The default setup and doctor paths SHALL treat agent-browser and Browser Use as optional automation integrations. When explicitly selected, Panerelay SHALL require agent-browser 0.33.0 or newer or Browser Use 0.13.7 or newer, report the selected engine's detected version, and keep its pinned compatibility baseline. Claude Code and Qoder CLI SHALL remain optional Agent providers rather than prerequisites for the Native Host or other integrations.

#### Scenario: Default setup has no automation-engine prerequisite

- **GIVEN** Node.js is supported and neither agent-browser nor Browser Use is installed
- **WHEN** the user runs `npx --yes @panerelay/setup` or its default doctor command
- **THEN** the Native Host installation can be healthy without an automation-engine dependency check

#### Scenario: Explicit agent-browser integration is below the supported minimum

- **GIVEN** the user selects the agent-browser integration and setup detects a version older than 0.33.0
- **WHEN** setup or `doctor --agent-browser` evaluates the integration
- **THEN** the agent-browser check fails with an actionable upgrade instruction

#### Scenario: Optional Claude Code runtime is absent

- **GIVEN** Native Messaging and Codex are otherwise ready
- **WHEN** Claude Code is not installed or cannot be executed
- **THEN** doctor and the side panel report Claude Code as unavailable without making the Native Host or selected automation integrations unhealthy

#### Scenario: Optional Qoder runtime is absent

- **GIVEN** Native Messaging and Codex are otherwise ready
- **WHEN** Qoder CLI is not installed or does not expose compatible ACP capabilities
- **THEN** doctor and the side panel report Qoder as unavailable without making the Native Host or selected automation integrations unhealthy

### Requirement: Provider selection is documented as opt-in configuration

Panerelay SHALL install the agent-browser Provider and Panerelay Skill only when setup receives `--agent-browser`, including the bounded setup-backed operation initiated by an explicit Extension settings click. Explicit `--provider panerelay`, project-default, and user-default agent-browser selection controls SHALL remain independent from browser authorization. Project-level or user-level setup options SHALL require the explicit agent-browser integration selection. Documentation SHALL identify Extension settings as an additional way to install a missing integration and set or clear its user-level default while the Native Host is connected.

#### Scenario: User follows the default installation path

- **GIVEN** neither automation integration has been selected
- **WHEN** the user runs `npx --yes @panerelay/setup`
- **THEN** setup installs the Native Host without probing agent-browser, writing agent-browser runtime configuration, installing its Provider or Skill, or injecting browser MCP tools into side-panel Agents
- **AND** it does not change a project-level or user-level agent-browser default

#### Scenario: User explicitly installs agent-browser support

- **GIVEN** agent-browser 0.33.0 or newer is available
- **WHEN** the user runs `npx --yes @panerelay/setup --agent-browser`
- **THEN** setup validates agent-browser and installs the Panerelay Provider registration and Skill
- **AND** side-panel Agents continue to use only their own Agent-managed MCP and Skill configuration
- **AND** the documented verification command explicitly selects `--provider panerelay` unless the user also selected a default scope

#### Scenario: User chooses a default Provider scope through setup

- **GIVEN** the user wants Panerelay selected without a command-line Provider flag
- **WHEN** they use `--agent-browser` together with the project-level or user-level setup option
- **THEN** documentation explains the affected configuration scope and states that no browser tab becomes authorized

#### Scenario: User omits explicit agent-browser selection for a default scope

- **GIVEN** the user invokes a project-level or user-level Provider option without `--agent-browser`
- **WHEN** setup validates the invocation
- **THEN** setup fails with guidance to add `--agent-browser`
- **AND** it does not install an integration or modify Provider configuration

#### Scenario: User manages an integration in the Extension

- **GIVEN** the Native Host is connected
- **WHEN** the user uses Extension settings for an installed or missing integration
- **THEN** documentation explains that the action may run the matching explicit setup operation before setting or clearing its user-level default
- **AND** it does not uninstall Panerelay or grant browser authorization
