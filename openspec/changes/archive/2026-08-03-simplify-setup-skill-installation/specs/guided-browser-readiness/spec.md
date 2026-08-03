## ADDED Requirements

### Requirement: Primary onboarding has two installation steps

Panerelay SHALL present the normal end-user onboarding path as installing the official Chrome Extension and installing the `panerelay-browser` Skill through `npx skills`. Manual `@panerelay/setup` commands, engine-specific connection details, compatibility boundaries, development installation, and troubleshooting SHALL remain available in an advanced section rather than the primary two-step path.

#### Scenario: New user follows the quickstart

- **GIVEN** a user opens either root README
- **WHEN** they follow the primary usage guide
- **THEN** step one links to the official Chrome Web Store Extension
- **AND** step two installs `panerelay-browser` using `npx skills add F-loat/panerelay --skill panerelay-browser`
- **AND** the guide states that the Agent will finish the selected local integration and pause for browser authorization

#### Scenario: User needs manual control

- **GIVEN** the user wants to run setup directly or inspect compatibility details
- **WHEN** they open the advanced guidance
- **THEN** they can find the explicit setup, doctor, connection, default-selection, development, and troubleshooting commands for all supported engines

### Requirement: Agent setup is delivered only through the installed Skill

Panerelay SHALL NOT publish or reference a standalone Agent setup document fetched with `curl` or another remote-document handoff. The website and repository documentation SHALL direct Agents and users to install `panerelay-browser` with `npx skills`; advanced human-readable references MAY describe the underlying commands without becoming a second Agent instruction source.

#### Scenario: User asks an Agent to configure Panerelay

- **GIVEN** the user reads the root README, website, or an automation package README
- **WHEN** they follow the Agent-directed setup path
- **THEN** the path installs `panerelay-browser` through `npx skills`
- **AND** it does not ask the Agent to fetch `agent-setup.md` with `curl`

#### Scenario: Website is built

- **GIVEN** the website source and build configuration are inspected
- **WHEN** the production bundle is created
- **THEN** it does not copy or serve a standalone `agent-setup.md`
- **AND** no site prompt or test depends on that URL
