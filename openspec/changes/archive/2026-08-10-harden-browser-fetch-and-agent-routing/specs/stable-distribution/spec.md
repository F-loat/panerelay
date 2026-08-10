## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Stable distribution includes the Fetch MCP entrypoint

Stable and beta Native Host artifacts SHALL include the same-version Fetch MCP mode and setup SHALL reference the stable launcher rather than a version directory for persistent Agent configuration. Release validation SHALL exercise the MCP initialize, tools/list, successful bounded fetch, denial, disconnect, and cleanup paths without retaining response bodies or credentials. The agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17 baselines SHALL remain unchanged.

#### Scenario: Candidate artifacts are verified

- **GIVEN** a lockstep candidate Native Host and setup package were prepared
- **WHEN** release validation inspects and exercises Agent fetch routing
- **THEN** the stable launcher starts the candidate Fetch MCP server and its version matches the Extension
- **AND** existing automation-engine compatibility groups pass without a capability reclassification caused only by this fetch tool
