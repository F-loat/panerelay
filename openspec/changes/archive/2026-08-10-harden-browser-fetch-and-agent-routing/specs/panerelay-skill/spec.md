## ADDED Requirements

### Requirement: Skill separates authenticated fetch from page automation

The `panerelay` Skill SHALL be the single Panerelay Agent entry point and use Panerelay Fetch MCP for HTTP(S) requests that need the user's existing browser login state when that tool is available. It SHALL continue to use the selected agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, or Playwright CLI 0.1.17 workflow for DOM inspection, navigation, interaction, downloads, and other browser automation. It SHALL NOT ask for API keys, claim that Panerelay directly implements browser automation, or claim that Panerelay intercepts native Agent web tools.

#### Scenario: Task needs only authenticated JSON

- **GIVEN** the Panerelay Fetch MCP tool is available and the domain is user-authorized
- **WHEN** an Agent needs an authenticated JSON endpoint without page interaction
- **THEN** the Skill uses the Fetch MCP tool
- **AND** it does not create an automation control lease

#### Scenario: Task needs page state or navigation

- **GIVEN** the task requires DOM, navigation, interaction, or a browser-process feature
- **WHEN** the Skill chooses a tool path
- **THEN** it uses the already selected supported automation engine
- **AND** it does not misrepresent Fetch MCP as page automation
