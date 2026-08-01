## MODIFIED Requirements

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

`@panerelay/setup` SHALL expose setup, update, doctor, and uninstall behavior without owning recurring browser-administration commands. Setup SHALL NOT silently install `@panerelay/cli` globally or modify the user's shell `PATH`; when the user explicitly selects an adapter integration, setup MAY install a private CLI launcher and adapter artifact for the installed Skill.

#### Scenario: User performs normal setup

- **GIVEN** the user invokes `npx --yes @panerelay/setup`
- **WHEN** setup completes
- **THEN** the Native Host, Provider registration, and Agent Skill are installed as requested
- **AND** no global Panerelay CLI or shell-path modification is added

#### Scenario: User requests a browser command from setup

- **GIVEN** browser administration has moved to `@panerelay/cli`
- **WHEN** the user supplies `browsers` or `browser use` to `@panerelay/setup`
- **THEN** setup rejects the command as unsupported
- **AND** its help keeps browser administration outside the setup command catalog

#### Scenario: User explicitly selects an adapter integration

- **GIVEN** a Skill requires recurring Panerelay CLI adapter calls
- **WHEN** the user selects that integration during setup
- **THEN** setup installs a private version-pinned CLI launcher and adapter artifact under Panerelay-owned storage
- **AND** the generated Skill uses that exact launcher
- **AND** neither package claims the user's global `panerelay` command

## ADDED Requirements

### Requirement: CLI adapters are explicitly registered and protocol bounded

The Panerelay CLI SHALL load connection adapters only from a protected setup-managed registry containing an adapter identifier, absolute executable path, expected protocol version, and declared capabilities. It SHALL NOT discover adapters from ambient package names or `PATH`, load adapter code into the CLI process, or invoke an adapter whose manifest is missing, incompatible, or inconsistent with its registration.

#### Scenario: Registered adapter is compatible

- **GIVEN** a protected adapter registration names an existing executable by absolute path
- **WHEN** the CLI verifies its manifest over the bounded stdio protocol
- **THEN** the CLI permits only operations declared by that manifest
- **AND** it invokes the adapter out of process with bounded input, output, and timeout limits

#### Scenario: Adapter registration is missing or unsafe

- **GIVEN** an adapter is unregistered, resolves through `PATH`, uses a relative path, has an incompatible protocol, or declares inconsistent capabilities
- **WHEN** a caller requests that adapter
- **THEN** the CLI fails explicitly before reading Bridge credentials or creating connection state

### Requirement: CLI connection commands preserve defaults and credentials

The CLI SHALL provide engine-neutral connection resolution and execution surfaces. It SHALL apply an explicit one-run mode over the Panerelay-owned saved default, select one live ready browser through the existing routing rules, pass only the opaque selected browser identity to the adapter request, and avoid printing Bridge bearer credentials. A run surface SHALL inject only the adapter-returned bounded environment into the child process and SHALL preserve the child's standard streams, signals, and exit status.

#### Scenario: Caller resolves a CDP URL

- **GIVEN** a compatible adapter and live selected browser are available
- **WHEN** the caller explicitly requests the connection URL output
- **THEN** the CLI returns only the adapter's short-lived scoped URL and documented metadata format
- **AND** it does not print the live registration bearer token or unrelated adapter configuration

#### Scenario: CLI runs an engine command

- **GIVEN** an adapter resolves a bounded environment for an engine
- **WHEN** the caller uses the CLI run surface with an explicit child command
- **THEN** the CLI starts that exact command without interpreting its automation arguments
- **AND** it applies the adapter environment only to that child
- **AND** it forwards standard streams, termination signals, and the final exit status

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
