## MODIFIED Requirements

### Requirement: Qoder browser access uses the existing scoped relay

Panerelay SHALL NOT inject an agent-browser or Browser Use MCP server, Skill, browser instruction, or per-conversation automation session into Qoder. Qoder SHALL receive its normal Agent configuration and environment, and any user-configured browser tool that connects through Panerelay SHALL remain subject to the same browser-side authorization, routing, and exclusive control lease as other automation participants.

#### Scenario: Qoder starts without a configured browser tool

- **GIVEN** Qoder is ready and its own Agent configuration contains no browser integration
- **WHEN** Panerelay creates or resumes a side-panel conversation
- **THEN** the ACP session receives no Panerelay-injected browser MCP server or Skill
- **AND** ordinary conversation behavior remains available

#### Scenario: Qoder uses its own Panerelay browser configuration

- **GIVEN** the user configured a supported browser tool directly in Qoder
- **WHEN** that tool connects through Panerelay from a side-panel conversation
- **THEN** it uses the current browser routing context and normal authorization and control-lease checks
- **AND** Panerelay does not rewrite or replace Qoder's tool configuration

### Requirement: Qoder-owned browser sessions clean up at terminal boundaries

Panerelay SHALL NOT assign, retain, or close an agent-browser or Browser Use session on behalf of a Qoder conversation. Qoder and its configured browser integration SHALL own their tool-process and session lifecycle, while Panerelay SHALL continue to revoke any resulting participant through the normal user release, transport-loss, heartbeat, and Extension/Native Host shutdown boundaries.

#### Scenario: Qoder turn reaches a terminal state

- **GIVEN** Qoder used a browser tool from its own configuration
- **WHEN** the ACP prompt completes, fails, or is interrupted
- **THEN** Panerelay reports the terminal turn without issuing an engine-specific close command
- **AND** normal relay liveness and user revocation remain available

#### Scenario: Qoder runtime exits

- **GIVEN** a configured browser participant outlives a Qoder runtime process
- **WHEN** Qoder exits or the provider closes
- **THEN** Panerelay does not kill or close the engine session by inferred ownership
- **AND** transport loss, heartbeat expiry, user release, or Native Host shutdown removes its browser authority
