## ADDED Requirements

### Requirement: Skill uses the Setup-provided CLI for recurring administration

The Panerelay Skill SHALL invoke recurring browser and connection administration through the global `panerelay` executable provided by base Setup. It SHALL NOT present temporary `npx @panerelay/cli` execution as an ordinary fallback. It SHALL continue to use `npx` for one-time Setup and independently managed Agent Skill lifecycle operations.

#### Scenario: Skill inspects multiple browsers

- **GIVEN** multiple browsers are ready through Panerelay
- **WHEN** the Skill needs to inspect their registrations
- **THEN** it runs `panerelay browsers`
- **AND** it does not invoke the CLI package temporarily

#### Scenario: Skill changes Browser Use connection mode

- **GIVEN** the user requests a durable Browser Use mode change
- **WHEN** the Skill applies that preference
- **THEN** it runs `panerelay connection use browser-use <mode>`
- **AND** it leaves one-time Setup commands on the documented `npx @panerelay/setup` path
