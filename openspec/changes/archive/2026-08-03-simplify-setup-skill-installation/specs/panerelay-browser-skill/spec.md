## Purpose

Define one independently managed Agent Skill that can prepare, operate, verify, and troubleshoot Panerelay with each supported browser automation engine.

## ADDED Requirements

### Requirement: One Skill covers every supported automation engine

Panerelay SHALL publish one discoverable `panerelay-browser` Skill that contains scenario-specific instructions for agent-browser 0.33.0 or newer, Browser Use 0.13.7 or newer with a complete Browser Harness runtime, and Playwright CLI 0.1.17 or newer. The Skill SHALL preserve each upstream engine's automation semantics and SHALL use only Panerelay's documented Provider, environment, or CDP connection surface.

#### Scenario: Agent receives an engine-specific browser task

- **GIVEN** the `panerelay-browser` Skill is available to an Agent
- **WHEN** the user asks it to use agent-browser, Browser Use, or Playwright CLI with Panerelay
- **THEN** the Agent follows the matching engine workflow from the same Skill
- **AND** it does not substitute another engine without explaining the compatibility difference

### Requirement: Skill lifecycle is managed through the Agent Skills CLI

Documentation SHALL install the Skill from the repository using `npx skills add F-loat/panerelay --skill panerelay-browser` and SHALL use the corresponding `npx skills` list, update, and remove operations for diagnosis and lifecycle management. `@panerelay/setup` SHALL NOT install, overwrite, remove, export, or diagnose the Skill.

#### Scenario: User installs Panerelay Agent guidance

- **GIVEN** the user has installed the Panerelay Extension
- **WHEN** they run the documented `npx skills add` command and select their Agent target and scope
- **THEN** the standard Agent Skills CLI installs `panerelay-browser`
- **AND** setup does not need to know the Agent's Skill directory

#### Scenario: User uninstalls Panerelay setup

- **GIVEN** `panerelay-browser` was installed through `npx skills`
- **WHEN** the user runs `npx --yes @panerelay/setup uninstall`
- **THEN** setup removes only Panerelay-owned host and automation-integration artifacts
- **AND** it leaves the independently managed Skill untouched

### Requirement: Skill drives a complete readiness workflow

The Skill SHALL inspect Node.js, the Extension connection, and only the automation engines requested by the user; install or repair missing supported upstream tools from their official sources with appropriate user consent; run setup for the selected Panerelay integration artifacts; stop for user-owned Extension installation and tab authorization; and report evidence from doctor plus an engine-specific authorized-tab check.

#### Scenario: Selected automation engine is missing

- **GIVEN** the user asks the Agent to configure one supported automation engine
- **WHEN** the Skill determines that its executable is missing or below the supported minimum
- **THEN** it identifies the official upstream installation source and the required version
- **AND** it does not change an unrelated engine, browser profile, shell startup file, or user default

#### Scenario: Browser authorization is required

- **GIVEN** the local integration is installed but the intended tab is not authorized
- **WHEN** readiness verification reaches the browser boundary
- **THEN** the Skill asks the user to install or open the Extension and authorize the intended scope
- **AND** it does not click authorization controls, infer permission from focus, or widen browser access

### Requirement: Skill troubleshooting covers both tool and Skill installation

The Skill SHALL provide actionable diagnosis for missing or unsupported agent-browser, Browser Use, Playwright CLI, incomplete Panerelay Provider/adapter installation, disconnected Extension state, missing or stale Skill installation, and incorrect engine-specific connection or default configuration.

#### Scenario: Agent cannot load the Skill or run the selected tool

- **GIVEN** a user reports that Panerelay browser automation is unavailable
- **WHEN** the Skill or documentation diagnoses the failure
- **THEN** it distinguishes Agent Skill discovery from automation-tool installation, Panerelay integration setup, Extension connection, and browser authorization
- **AND** it gives the smallest matching `npx skills`, upstream-tool, setup, doctor, or authorization action
