## ADDED Requirements

### Requirement: Claude Code setup guidance is targeted

Setup, doctor, and the Extension SHALL identify Claude Code independently from Codex and Qoder and SHALL present the supported installation and login commands when it is unavailable.

#### Scenario: Claude Code is not discovered

- **GIVEN** setup cannot find a usable `claude` executable
- **WHEN** the user runs setup or doctor or selects the Claude provider
- **THEN** Panerelay reports Claude Code as optional, shows `npm install -g @anthropic-ai/claude-code`, and directs the user to run `claude` to authenticate
