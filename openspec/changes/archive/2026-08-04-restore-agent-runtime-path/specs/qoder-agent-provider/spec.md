## MODIFIED Requirements

### Requirement: Qoder browser access uses the existing scoped relay

Panerelay SHALL NOT inject an agent-browser or Browser Use MCP server, Skill, browser instruction, per-conversation automation session, or local executable path into Qoder conversation context. Qoder SHALL receive its normal Agent configuration and a bounded command environment reconstructed from protected setup-time path entries plus the current Native Host environment. Any user-configured browser tool that connects through Panerelay SHALL remain subject to the same browser-side authorization, routing, and exclusive control lease as other automation participants.

#### Scenario: Qoder starts without a configured browser tool

- **GIVEN** Qoder is ready and its own Agent configuration contains no browser integration
- **WHEN** Panerelay creates or resumes a side-panel conversation
- **THEN** the ACP session receives no Panerelay-injected browser MCP server or Skill
- **AND** ordinary conversation behavior remains available

#### Scenario: Qoder invokes a setup-visible user command

- **GIVEN** `agent-browser` and its Node runtime were available on the absolute command-search path when Panerelay setup installed the Native Host
- **AND** Chrome later starts the Native Host with only a minimal system path
- **WHEN** Qoder invokes `agent-browser` from its normal command tool
- **THEN** Qoder resolves it through the protected setup-captured Agent runtime path
- **AND** no absolute executable path is added to the prompt, activity title, provider descriptor, or shared protocol

#### Scenario: Qoder uses its own Panerelay browser configuration

- **GIVEN** the user configured a supported browser tool directly in Qoder
- **WHEN** that tool connects through Panerelay from a side-panel conversation
- **THEN** it uses the current browser routing context and normal authorization and control-lease checks
- **AND** Panerelay does not rewrite or replace Qoder's tool configuration

#### Scenario: Captured command path is stale

- **GIVEN** a protected path entry no longer contains the requested executable
- **WHEN** Qoder invokes that command
- **THEN** the command fails through Qoder's ordinary execution result
- **AND** Panerelay does not scan version-manager directories, source shell startup files, or silently install or switch tools
