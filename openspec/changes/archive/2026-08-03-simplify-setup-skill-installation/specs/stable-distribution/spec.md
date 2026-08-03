## MODIFIED Requirements

### Requirement: Provider selection is documented as opt-in configuration

Panerelay SHALL install the agent-browser Provider only when setup receives `--agent-browser`, including the bounded setup-backed operation initiated by an explicit Extension settings click. Agent Skills SHALL be distributed independently from setup through the repository-level `panerelay-browser` Skill and managed with `npx skills`. Explicit `--provider panerelay` and user-default agent-browser selection controls SHALL remain independent from browser authorization. User-level setup options SHALL require an explicit default-capable integration selection. Documentation SHALL identify Extension settings as an additional way to install a missing integration and set or clear its user-level default while the Native Host is connected.

#### Scenario: User follows the default setup path

- **GIVEN** neither automation integration has been selected
- **WHEN** the user runs `npx --yes @panerelay/setup`
- **THEN** setup installs the Native Host without probing agent-browser, writing agent-browser runtime configuration, installing its Provider, managing an Agent Skill, or injecting browser MCP tools into side-panel Agents
- **AND** it does not change a user-level agent-browser default

#### Scenario: User explicitly installs agent-browser support

- **GIVEN** agent-browser 0.33.0 or newer is available
- **WHEN** the user runs `npx --yes @panerelay/setup --agent-browser`
- **THEN** setup validates agent-browser and installs the Panerelay Provider registration
- **AND** it does not install, update, remove, or diagnose any Agent Skill
- **AND** side-panel Agents continue to use only their own Agent-managed MCP and Skill configuration
- **AND** the documented verification command explicitly selects `--provider panerelay` unless the user also selected the user default

#### Scenario: User chooses the user default through setup

- **GIVEN** the user wants Panerelay selected without a command-line Provider or environment override
- **WHEN** they select agent-browser and/or Browser Use with `--global-default`
- **THEN** documentation explains the affected user-level configuration and states that no browser tab becomes authorized
- **AND** Playwright remains outside the default selection

#### Scenario: User omits an explicit default-capable integration

- **GIVEN** the user invokes `--global-default` without `--agent-browser` or `--browser-use`
- **WHEN** setup validates the invocation
- **THEN** setup fails with guidance to add a default-capable integration
- **AND** it does not install an integration or modify Provider configuration

#### Scenario: User manages an integration in the Extension

- **GIVEN** the Native Host is connected
- **WHEN** the user uses Extension settings for an installed or missing integration
- **THEN** documentation explains that the action may run the matching explicit setup operation before setting or clearing its user-level default
- **AND** it does not install an Agent Skill, uninstall Panerelay, or grant browser authorization

## ADDED Requirements

### Requirement: Stable repository exposes one independently installable Skill

The stable source repository SHALL expose exactly one public Panerelay browser-automation Skill in a standard `npx skills` discovery path. Release validation SHALL verify its frontmatter, three supported engine workflows, independent installation command, and absence from the packed `@panerelay/setup` artifact.

#### Scenario: Stable artifacts are inspected

- **GIVEN** a stable or beta candidate is prepared
- **WHEN** release validation inspects the repository and packed setup package
- **THEN** the repository exposes `panerelay-browser` to `npx skills`
- **AND** the packed setup package contains no bundled Agent Skill or Skill lifecycle module
