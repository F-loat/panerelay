# panerelay-cli Specification

## Purpose

Define an engine-neutral Panerelay command-line interface for recurring local browser administration without turning the one-time setup package into a persistent user command.

## Requirements

### Requirement: Panerelay provides a standalone administration CLI

Panerelay SHALL publish an optional `@panerelay/cli` package whose executable name is `panerelay`. The CLI SHALL manage Panerelay browser registrations and routing preferences and SHALL dispatch setup-managed connection adapters without embedding an automation engine or implementing browser automation commands.

#### Scenario: User installs the CLI globally

- **GIVEN** the user wants a persistent Panerelay administration command
- **WHEN** they install `@panerelay/cli` globally
- **THEN** `panerelay browsers`, `panerelay browser use <selector>`, and `panerelay browser clear` are available
- **AND** the installation does not install or select agent-browser, browser-use, or another automation engine

#### Scenario: User invokes the CLI without installing it globally

- **GIVEN** the user needs an occasional browser-administration command
- **WHEN** they run `npx --yes @panerelay/cli <command>`
- **THEN** the command has the same browser-registry behavior as the global `panerelay` executable

#### Scenario: CLI dispatches an installed connection adapter

- **GIVEN** setup registered a compatible connection adapter by exact path
- **WHEN** the user or installed Skill asks the CLI to resolve or run that adapter
- **THEN** the CLI performs browser and mode selection and invokes the adapter through the bounded adapter protocol
- **AND** the adapter's automation engine remains responsible for every browser command

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

### Requirement: CLI adapters are explicitly registered and protocol bounded

The Panerelay CLI SHALL load connection adapters only from a protected setup-managed registry containing an adapter identifier, absolute executable path, expected protocol version, declared capabilities, and a `childEnvironmentKeys` allow-list. It SHALL NOT discover adapters from ambient package names or `PATH`, load adapter code into the CLI process, or invoke an adapter whose manifest is missing, incompatible, or inconsistent with its registration.

#### Scenario: Registered adapter is compatible

- **GIVEN** a protected adapter registration names an existing executable by absolute path
- **WHEN** the CLI verifies its manifest over the bounded stdio protocol
- **THEN** the CLI permits only operations declared by that manifest
- **AND** it accepts only adapter-returned child environment keys declared by the matching registration and manifest
- **AND** it invokes the adapter out of process with bounded input, output, and timeout limits

#### Scenario: Adapter registration is missing or unsafe

- **GIVEN** an adapter is unregistered, resolves through `PATH`, uses a relative path, has an incompatible protocol, or declares inconsistent capabilities
- **WHEN** a caller requests that adapter
- **THEN** the CLI fails explicitly before reading Bridge credentials or creating connection state

### Requirement: CLI connection commands preserve defaults and credentials

The CLI SHALL provide engine-neutral connection resolution and execution surfaces. It SHALL apply an explicit one-run mode over the Panerelay-owned saved default and avoid printing Bridge bearer credentials. In Extension mode only, it SHALL select one live ready browser through the existing routing rules and pass only the opaque selected browser identity to the adapter request. Direct mode SHALL bypass Panerelay browser selection and Bridge connection state. A run surface SHALL inject only the adapter-returned bounded environment into the child process and SHALL preserve the child's standard streams, signals, and exit status.

#### Scenario: Caller resolves a CDP URL

- **GIVEN** a compatible adapter is available and Extension mode has selected one live browser
- **WHEN** the caller explicitly requests the connection URL output
- **THEN** the CLI returns only the adapter's short-lived scoped URL and documented metadata format
- **AND** it does not print the live registration bearer token or unrelated adapter configuration

#### Scenario: Caller resolves a Direct connection

- **GIVEN** a compatible adapter resolves in Direct mode
- **WHEN** no live Panerelay browser registration is available
- **THEN** the CLI returns the adapter's Direct connection result without selecting a browser
- **AND** it reads no Bridge connection credentials and creates no Panerelay connection state

#### Scenario: CLI runs an engine command

- **GIVEN** an adapter resolves a bounded environment for an engine
- **WHEN** the caller uses the CLI run surface with an explicit child command
- **THEN** the CLI starts that exact command without interpreting its automation arguments
- **AND** it applies the adapter environment only to that child
- **AND** it forwards standard streams, termination signals, and the final exit status
- **AND** when the adapter returns a concurrency key, the CLI waits at most 750 milliseconds for that user-scoped lane before failing deterministically with `busy`

#### Scenario: One-run mode overrides the saved preference

- **GIVEN** a Direct or Extension adapter mode is saved
- **WHEN** a caller supplies the other mode for one connection command
- **THEN** the CLI uses the explicit mode for that command only
- **AND** it leaves the saved preference, browser default, and other running adapter connections unchanged

#### Scenario: Selected browser becomes unavailable

- **GIVEN** browser selection resolves an opaque registration ID
- **WHEN** the browser or owning Native Host exits before the adapter obtains connection material
- **THEN** the CLI or adapter fails with an unavailable-generation error
- **AND** it does not silently select another browser or fall back to Direct automation

### Requirement: Browser administration is localized and bounded

The Panerelay CLI SHALL support English and Simplified Chinese human-readable help, argument errors, browser listings, and default-management results. It SHALL expose only bounded registration metadata and SHALL NOT print bearer credentials or change permissions, targets, participants, or control leases.

#### Scenario: User lists connected browsers

- **GIVEN** multiple browser registrations are live
- **WHEN** the user runs `panerelay browsers`
- **THEN** the selected locale is used for presentation
- **AND** the output contains browser names, families, opaque registration IDs, readiness, and the saved-default marker
- **AND** it contains no relay token

#### Scenario: User selects the saved default

- **GIVEN** an exact registration ID or unambiguous browser family selects one live ready browser
- **WHEN** the user runs `panerelay browser use <selector>`
- **THEN** only the routing preference changes
- **AND** browser permissions, authorization, targets, active participants, and control leases remain unchanged

#### Scenario: User clears the saved default

- **GIVEN** a saved browser preference exists
- **WHEN** the user runs `panerelay browser clear`
- **THEN** the saved routing preference is removed without requiring a live browser
- **AND** browser permissions, authorization, targets, active participants, and control leases remain unchanged

#### Scenario: Browser selector conflicts with ambient process state

- **GIVEN** the process environment contains a different browser selector
- **WHEN** the user supplies an explicit selector to `panerelay browser use`
- **THEN** the CLI applies the command argument
- **AND** it does not save the ambient selector instead
