## ADDED Requirements

### Requirement: Panerelay CLI provides a Fetch MCP server mode

The installed Panerelay executable SHALL provide a stdio MCP mode for the bounded Panerelay Fetch tool. The mode SHALL write only MCP protocol messages to stdout, keep bounded diagnostics free of credentials, reuse existing browser selection and fetch clients, release each exact-origin session after the call, and terminate cleanly when the MCP client closes stdin.

#### Scenario: MCP client launches the stable command

- **GIVEN** Panerelay setup installed the stable host launcher and one browser is live
- **WHEN** an MCP client starts the documented Fetch MCP command and calls its tool
- **THEN** it receives a valid MCP result backed by the selected browser
- **AND** the process does not start a second Native Messaging host or print setup text to stdout

#### Scenario: MCP request is invalid

- **GIVEN** an MCP client supplies an unsupported method, URL, body, or response option
- **WHEN** Panerelay validates the call
- **THEN** it returns a bounded MCP tool error
- **AND** no fetch session or browser network request remains active
