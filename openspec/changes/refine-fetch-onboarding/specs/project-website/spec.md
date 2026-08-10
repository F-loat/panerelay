## MODIFIED Requirements

### Requirement: Coherent repository onboarding

The root English and Simplified Chinese READMEs SHALL lead with the two user outcomes, Fetch and Connect, and SHALL present Extension installation plus the repository Skill as the complete normal onboarding path. Their primary Fetch guidance SHALL present site-adapter installation before domain authorization, SHALL document both individual built-in adapter installation and `npx --yes @panerelay/setup add --all`, and SHALL credit and link to OpenCLI as the source from which the built-in fetch-compatible site catalog was migrated. External Agent MCP configuration, optional setup flags, manual verification, Skill lifecycle commands, and Panerelay installation management SHALL appear in one default-collapsed advanced section after a Mermaid architecture overview. The quickstart SHALL end with a concise instruction for asking the Agent to use the Skill, and side-panel functionality SHALL remain secondary rather than replacing the Fetch and Connect paths.

The root READMEs SHALL omit redundant supported-workflow and documentation sections while preserving top navigation and targeted inline links. Integration READMEs SHALL lead with the supported user outcome, flexible authorization scopes, prerequisites, Agent-guided setup, success criteria, upstream documentation, and compatibility record before internal adapter terminology, while technical CLI reference remains discoverable. Repository guidance SHALL use consistent labels for Fetch, Connect, peer automation integrations, current-domain/all-domain Fetch authorization, current-tab/all-supported-tabs automation authorization, accepted minimums, and exact verified baselines.

#### Scenario: New user chooses a setup path

- **GIVEN** a user opens either root README without prior Panerelay knowledge
- **WHEN** the user reaches the quickstart
- **THEN** the user sees the Extension-plus-Skill installation path and can ask an Agent to use the Skill for Fetch or Connect with agent-browser, Browser Use, or Playwright CLI

#### Scenario: User enables built-in site adapters

- **GIVEN** a user is reading the primary Fetch guide
- **WHEN** the user reviews site-specific support
- **THEN** individual adapter installation and the all-built-in `@panerelay/setup add --all` command appear before domain authorization
- **AND** the guide credits and links to OpenCLI without implying that unsupported DOM, WAF, or key-based behavior was migrated

#### Scenario: User needs external Agent MCP configuration

- **GIVEN** a user wants to configure an external Agent's MCP client directly
- **WHEN** the user opens the advanced management section
- **THEN** the Fetch MCP configuration and tool details are available there
- **AND** they do not interrupt the primary Fetch onboarding path

#### Scenario: Reader understands the architecture overview

- **GIVEN** a user reaches the root README architecture overview
- **WHEN** the workflow is rendered by a Mermaid-capable Markdown viewer
- **THEN** Fetch and Connect visibly converge on the Bridge and Extension while retaining their distinct authorized domain and tab targets

#### Scenario: Browser Use user finds the supported boundary

- **GIVEN** a user opens the Browser Use integration README
- **WHEN** the user reviews prerequisites and compatibility
- **THEN** the document links to upstream Browser Use documentation, identifies supported Browser Harness-backed CLI and CLI MCP surfaces in the unified Skill, and states that arbitrary Python SDK construction is outside the transparent integration
