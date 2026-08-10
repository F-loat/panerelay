## ADDED Requirements

### Requirement: Agent fetch integration lifecycle is localized and explicit

Setup SHALL provide localized English and Simplified Chinese help, confirmation, applied-change output, diagnostics, and remediation for installing or removing external Codex and Claude Code Fetch MCP routing. Human-readable output SHALL identify which Agent configuration is affected and that browser authorization remains a separate user action; machine-readable doctor output SHALL remain locale-independent and omit settings content and credentials.

#### Scenario: User requests localized integration help

- **GIVEN** the user selects Simplified Chinese
- **WHEN** they request setup help for Agent fetch routing
- **THEN** setup explains the explicit install, diagnosis, and removal controls in Simplified Chinese
- **AND** executable names, MCP server IDs, paths, and machine-readable fields remain unchanged

#### Scenario: Setup detects conflicting user configuration

- **GIVEN** an existing Agent entry with Panerelay's reserved MCP name is not owned by setup
- **WHEN** the user tries to install the integration
- **THEN** setup fails with localized conflict guidance
- **AND** it does not overwrite or print the existing entry
