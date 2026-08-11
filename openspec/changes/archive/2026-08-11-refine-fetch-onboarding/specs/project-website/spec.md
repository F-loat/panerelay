## MODIFIED Requirements

### Requirement: Coherent repository onboarding

The root English and Simplified Chinese READMEs SHALL lead with the two user outcomes, Fetch and Connect, and SHALL present Extension installation, base Setup, and the repository Skill as the complete normal onboarding path. They SHALL explain that base Setup provides the bare `panerelay` command before any example invokes that command, while the Skill guides an Agent through Fetch and Connect setup and use. Their primary Fetch guidance SHALL present site-adapter installation before domain authorization, SHALL document both individual built-in adapter installation and `npx --yes @panerelay/setup add --all`, and SHALL credit and link to OpenCLI as the source from which the built-in fetch-compatible site catalog was migrated. The primary Connect guidance SHALL ask the Agent Skill to configure and verify the selected engine while linking to engine-specific guides. External Agent MCP configuration, optional setup flags, manual Connect setup and verification, Skill lifecycle commands, and Panerelay installation management SHALL appear in one default-collapsed advanced section after a Mermaid architecture overview. FAQ answers and contributor commands SHALL also remain collapsed by default. The quickstart SHALL end with a concise instruction for asking the Agent to use the Skill, and side-panel functionality SHALL remain secondary rather than replacing the Fetch and Connect paths.

The root READMEs SHALL omit redundant supported-workflow and documentation sections while preserving top navigation and targeted inline links. Integration READMEs SHALL lead with the supported user outcome, flexible authorization scopes, prerequisites, Agent-guided setup, success criteria, upstream documentation, and compatibility record before internal adapter terminology, while technical CLI reference remains discoverable. Repository guidance SHALL use consistent labels for Fetch, Connect, peer automation integrations, current-domain/all-domain Fetch authorization, current-tab/all-supported-tabs automation authorization, accepted minimums, and exact verified baselines.

#### Scenario: New user chooses a setup path

- **GIVEN** a user opens either root README without prior Panerelay knowledge
- **WHEN** the user reaches the quickstart
- **THEN** the user sees the Extension, CLI, and Skill installation path and can ask an Agent to use the Skill for Fetch or Connect with agent-browser, Browser Use, or Playwright CLI

#### Scenario: User runs a documented CLI command

- **GIVEN** a user follows either root README from the quickstart
- **WHEN** the user reaches a raw Fetch or site-adapter example using the bare `panerelay` command
- **THEN** the README has already run base Setup and explained that it provides the global CLI command
- **AND** adapter setup is not described as installing or modifying the CLI executable

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

#### Scenario: Reader follows the recommended path without manual detours

- **GIVEN** a new user reads either root README or scrolls the homepage in order
- **WHEN** the user follows the normal onboarding path
- **THEN** Extension installation, base Setup, and Skill installation appear before Fetch or Connect execution
- **AND** manual integration commands, FAQ answers, and contributor-only commands do not interrupt that path

#### Scenario: Reader understands the architecture overview

- **GIVEN** a user reaches the root README architecture overview
- **WHEN** the workflow is rendered by a Mermaid-capable Markdown viewer
- **THEN** Fetch and Connect visibly converge on the Bridge and Extension while retaining their distinct authorized domain and tab targets

#### Scenario: Browser Use user finds the supported boundary

- **GIVEN** a user opens the Browser Use integration README
- **WHEN** the user reviews prerequisites and compatibility
- **THEN** the document links to upstream Browser Use documentation, identifies supported Browser Harness-backed CLI and CLI MCP surfaces in the unified Skill, and states that arbitrary Python SDK construction is outside the transparent integration

## ADDED Requirements

### Requirement: Homepage provides a contained and actionable Fetch-first introduction

The English and Simplified Chinese homepages SHALL use a concise hero headline that remains inside its copy column without painting beneath the walkthrough at wide desktop widths or increasing document width at 375 CSS pixels. The hero title, supporting sentence, actions, and property list SHALL avoid repeating the same Fetch and Connect explanation in equivalent wording. After the hero and concise value explanation, the page SHALL present Setup before the Fetch and Connect workflows, followed by the trust boundary. Manual integration commands inside Setup SHALL be collapsed by default.

The Fetch and Connect section SHALL present the Fetch workflow before the Connect engine comparison. Its Fetch example SHALL show a complete executable path in this order: run base Setup, authorize an exact domain, call an absolute HTTP(S) URL with the bare `panerelay` command, and optionally install and invoke a site adapter. It SHALL distinguish the CLI from the Agent Skill and SHALL NOT present a relative URL as a standalone raw Fetch target. The setup section SHALL expose both Setup and Skill installation commands before Agent handoff instructions.

#### Scenario: Visitor learns the shortest Fetch path

- **GIVEN** a visitor knows an authenticated HTTP(S) endpoint
- **WHEN** the visitor reads the homepage Fetch workflow
- **THEN** the visitor can run Setup, approve the exact domain, and run one absolute-URL Fetch command without consulting another page
- **AND** the same workflow shows how a built-in site adapter is installed before its bare `panerelay` command is used

#### Scenario: Visitor distinguishes the CLI and Skill

- **GIVEN** a visitor reaches the hero or setup section
- **WHEN** installation guidance is rendered
- **THEN** the page identifies base Setup as the source of the persistent `panerelay` command
- **AND** it identifies the repository Skill as Agent workflow guidance rather than the CLI executable

#### Scenario: Localized hero stays in its layout track

- **GIVEN** either localized homepage is rendered at a wide desktop viewport or 375 CSS pixels
- **WHEN** the hero headline and supporting Fetch and Connect sentence are visible
- **THEN** the text remains inside the intended copy track without horizontal document overflow or collision with the walkthrough
