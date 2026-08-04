## ADDED Requirements

### Requirement: OpenCode setup guidance is targeted

Setup, doctor, and the Extension SHALL identify OpenCode independently from Codex, Claude Code, and Qoder and SHALL present the supported installation and authentication commands when it is unavailable. The guidance SHALL NOT install OpenCode, collect model credentials, grant browser authorization, or make the optional provider a Native Host prerequisite.

#### Scenario: OpenCode is not discovered

- **GIVEN** setup cannot find a usable `opencode` executable
- **WHEN** the user runs setup or doctor or selects the OpenCode provider
- **THEN** Panerelay reports OpenCode as optional, shows `npm install -g opencode-ai`, and directs the user to run `opencode auth login`

#### Scenario: OpenCode is discovered after setup

- **GIVEN** OpenCode was installed or moved after the Native Host registration was created
- **AND** the Side Panel still shows OpenCode as unavailable through its existing Native Host connection
- **WHEN** the user reruns setup and selects the Side Panel action to check providers again
- **THEN** Panerelay persists the newly resolved executable and reports its detected version
- **AND** the Side Panel refreshes provider descriptors without restarting the Native Host or changing the selected workspace, conversation, or browser authorization
- **AND** no Agent conversation or browser participant starts during discovery
