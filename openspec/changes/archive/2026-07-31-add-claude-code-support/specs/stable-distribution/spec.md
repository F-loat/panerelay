## MODIFIED Requirements

### Requirement: Stable setup declares and diagnoses supported dependencies

Panerelay SHALL require Node.js 20 or newer and agent-browser 0.33.0 or newer, report detected versions, and treat Claude Code and Qoder CLI as optional Agent providers rather than prerequisites for browser automation or Codex conversations.

#### Scenario: agent-browser is below the supported minimum

- **GIVEN** setup detects an agent-browser version older than 0.33.0
- **WHEN** the user runs doctor
- **THEN** the agent-browser check fails with an actionable upgrade instruction

#### Scenario: Optional Claude Code runtime is absent

- **GIVEN** Native Messaging, agent-browser, and Codex are otherwise ready
- **WHEN** Claude Code is not installed or cannot be executed
- **THEN** doctor and the side panel report Claude Code as unavailable without making the complete Panerelay installation unhealthy

#### Scenario: Optional Qoder runtime is absent

- **GIVEN** Native Messaging, agent-browser, and Codex are otherwise ready
- **WHEN** Qoder CLI is not installed or does not expose compatible ACP capabilities
- **THEN** doctor and the side panel report Qoder as unavailable without making the complete Panerelay installation unhealthy
