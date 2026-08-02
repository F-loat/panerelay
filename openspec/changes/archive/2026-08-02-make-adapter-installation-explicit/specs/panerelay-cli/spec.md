## MODIFIED Requirements

### Requirement: Setup remains a one-time integration surface

`@panerelay/setup` SHALL expose setup, update, doctor, and uninstall behavior without owning recurring browser-administration commands. Plain setup SHALL install only the user-scoped Native Host and side-panel runtime prerequisites. Setup SHALL NOT silently install `@panerelay/cli` globally, modify the user's shell `PATH`, or install either automation integration. `--agent-browser` and `--browser-use` SHALL independently select their peer setup-managed integrations and MAY be combined in one invocation.

#### Scenario: User performs base setup

- **GIVEN** the user invokes `npx --yes @panerelay/setup`
- **WHEN** setup completes
- **THEN** the Native Host and side-panel runtime prerequisites are installed
- **AND** no automation engine is probed and no agent-browser Provider, agent-browser Skill, Browser Use adapter, Browser Use Skill, global Panerelay CLI, side-panel MCP override, or shell-path modification is added

#### Scenario: User requests a browser command from setup

- **GIVEN** browser administration has moved to `@panerelay/cli`
- **WHEN** the user supplies `browsers` or `browser use` to `@panerelay/setup`
- **THEN** setup rejects the command as unsupported
- **AND** its help keeps browser administration outside the setup command catalog

#### Scenario: User explicitly selects agent-browser

- **GIVEN** the user wants agent-browser to connect through Panerelay
- **WHEN** setup receives `--agent-browser`
- **THEN** setup validates agent-browser and installs its Panerelay Provider and Skill in addition to the base Native Host
- **AND** it does not inject an MCP server or Skill into a side-panel conversation
- **AND** it does not install or modify agent-browser itself

#### Scenario: User explicitly selects Browser Use

- **GIVEN** the user wants Browser Use to connect through Panerelay
- **WHEN** setup receives `--browser-use`
- **THEN** setup installs the private version-pinned CLI launcher, adapter artifact, and Browser Use Skill in addition to the base Native Host
- **AND** it does not install or modify Browser Use itself

#### Scenario: User selects both automation integrations

- **GIVEN** both supported engines satisfy their pinned minimum versions
- **WHEN** setup receives `--agent-browser --browser-use`
- **THEN** setup installs both peer integrations and the shared Native Host in one idempotent invocation
- **AND** neither integration becomes the implicit default for the other
