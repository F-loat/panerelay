## ADDED Requirements

### Requirement: Claude Code Provider routes WebFetch work through Panerelay Fetch

Every Panerelay-owned Claude Code turn SHALL add the Panerelay Fetch MCP server alongside the turn-scoped approval server and SHALL deny the built-in `WebFetch` tool through that process's supported settings input. The Provider SHALL preserve user, project, and local settings, leave `WebSearch` unchanged, normalize MCP activity through the existing conversation stream, and close only Panerelay's turn-scoped server resources.

#### Scenario: Claude selects Panerelay Fetch

- **GIVEN** a Panerelay-owned Claude turn needs authenticated HTTP content
- **WHEN** Claude evaluates its available tools
- **THEN** the Panerelay Fetch MCP tool is available and built-in WebFetch is denied
- **AND** permission approval, interruption, and conversation resume continue through existing Provider behavior

#### Scenario: Panerelay Fetch is unavailable

- **GIVEN** the Extension or selected browser is disconnected
- **WHEN** Claude calls the Fetch MCP tool
- **THEN** the tool returns a bounded unavailable error
- **AND** the Provider does not re-enable WebFetch, widen browser authorization, or silently use another browser
