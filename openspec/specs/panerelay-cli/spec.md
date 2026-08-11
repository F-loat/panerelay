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

### Requirement: Setup manages the normal global CLI lifecycle without taking over existing installations

`@panerelay/setup` SHALL continue to expose setup, update, doctor, uninstall, and explicit integration behavior without owning recurring browser-administration semantics. A normal setup, install, or update invocation SHALL detect both the current npm-global `@panerelay/cli` package and a PATH-visible non-project `panerelay` command before mutating the Native Host. If no global CLI exists, Setup SHALL install the exact Setup release through structured npm arguments and record protected Setup ownership. A later setup or update SHALL skip an already matching version and SHALL update an older version only when the installed version still matches that ownership record. A pre-existing, externally changed, or alternate-Node-prefix global CLI SHALL be preserved without reinstalling, downgrading, or claiming ownership. A project-local `node_modules/.bin` command SHALL NOT suppress the normal global lifecycle.

Setup SHALL expose `--no-cli` for an explicit base setup without global CLI lifecycle. Uninstall SHALL remove only a CLI whose installed version still matches Setup's ownership record and SHALL expose `--keep-cli`. Adapter `add`, `remove`, and `adapters` operations SHALL NOT install, update, remove, or claim the global CLI. Setup SHALL continue not to edit shell startup files or install upstream automation engines.

#### Scenario: First base setup provides the command

- **GIVEN** no global `@panerelay/cli` installation or Setup ownership record exists
- **WHEN** the user runs base Setup
- **THEN** Setup installs its exact `@panerelay/cli` release before installing the Native Host
- **AND** records protected ownership so later setup and update invocations can keep it in lockstep

#### Scenario: Matching Setup-managed CLI is current

- **GIVEN** the global CLI and Setup ownership record both name the current Setup release
- **WHEN** setup or update runs again
- **THEN** Setup does not invoke a global package installation
- **AND** the existing command remains available

#### Scenario: Setup-managed CLI is updated

- **GIVEN** the global CLI version still matches an older Setup ownership record
- **WHEN** a newer exact Setup release runs setup or update
- **THEN** Setup installs the newer exact CLI release and updates its ownership record

#### Scenario: Existing user installation is preserved

- **GIVEN** a global CLI exists without a matching Setup ownership record
- **WHEN** setup or update runs
- **THEN** Setup reports and preserves that installation without reinstalling or claiming it

#### Scenario: Existing command belongs to another Node prefix

- **GIVEN** `panerelay` is PATH-visible from an NVM, Volta, or npm prefix different from the npm executable currently selected by Setup
- **AND** no matching Setup ownership record exists
- **WHEN** setup or update runs
- **THEN** Setup preserves the existing command without consulting the current prefix for an installation mutation

#### Scenario: Adapter installation remains independent

- **GIVEN** the user runs `npx --yes @panerelay/setup add bilibili`
- **WHEN** the adapter is installed
- **THEN** Setup does not probe or change the global CLI
- **AND** documentation has already instructed the user to run base Setup before adapter installation

#### Scenario: Uninstall preserves user-owned CLI

- **GIVEN** the global CLI has no matching Setup ownership record
- **WHEN** Panerelay uninstall runs
- **THEN** the CLI remains installed
- **AND** only Panerelay-owned local integration files are removed

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

### Requirement: Panerelay CLI provides browser-backed fetch

The standalone `panerelay` CLI SHALL provide `fetch` as a recurring local command in addition to browser administration and automation-adapter dispatch. A URL first operand SHALL invoke raw browser fetch, while an installed site ID first operand SHALL dispatch that site's fetch adapter. Fetch SHALL reuse existing browser selection, localization, and credential non-disclosure behavior without implementing page automation semantics.

#### Scenario: Caller fetches a URL

- **GIVEN** one live browser can be selected
- **WHEN** the user runs `panerelay fetch https://example.com/api`
- **THEN** the CLI prints the structured result from that browser-backed request
- **AND** it does not attach, navigate, focus, or control a browser tab

#### Scenario: Caller selects a browser explicitly

- **GIVEN** multiple live browsers are registered
- **WHEN** the user supplies `--browser <selector>` to a raw or adapter-backed fetch
- **THEN** the explicit selector takes priority for that invocation
- **AND** the saved browser default remains unchanged

#### Scenario: First operand is ambiguous text

- **GIVEN** a first operand is neither an absolute HTTP or HTTPS URL nor an installed site adapter ID
- **WHEN** the CLI parses the fetch invocation
- **THEN** it fails with localized guidance showing raw URL and installed-adapter forms
- **AND** it does not read Bridge credentials

### Requirement: Raw fetch options follow familiar request conventions

The CLI SHALL accept `--method`, repeated `--header` or `-H`, repeated `--query`, `--data`, `--data-base64`, `--response`, `--timeout`, `--cookies`, `--no-cookies`, and `--browser` options. Header and query options SHALL accept `name:value` input without discarding values that contain additional colons, and mutually exclusive body or cookie options SHALL fail before a request is sent.

#### Scenario: Origin and Referer are customized

- **GIVEN** the target origin is authorized in Chrome
- **WHEN** the user supplies `-H 'Origin: https://www.bilibili.com' -H 'Referer: https://www.bilibili.com/'`
- **THEN** the raw fetch request preserves both values

#### Scenario: Help is requested without a browser

- **GIVEN** no browser is connected
- **WHEN** the user runs `panerelay fetch --help`
- **THEN** the CLI prints localized fetch usage and installed site metadata successfully
- **AND** it does not require or probe a Bridge connection

### Requirement: Adapter command options take precedence after the command operand

For adapter invocations, Panerelay SHALL treat options after `<site> <command>` as site-command arguments when declared by that command's manifest. In particular, `--lang` after `bilibili subtitle` SHALL select a subtitle language, while Panerelay interface localization SHALL remain available by placing global `--lang` before the `fetch` command or before the site command operands.

#### Scenario: Caller selects a subtitle language

- **GIVEN** the installed Bilibili `subtitle` command declares a `lang` option
- **WHEN** the user runs `panerelay fetch bilibili subtitle <bvid> --lang zh-CN`
- **THEN** `zh-CN` is forwarded to the adapter as the subtitle language
- **AND** it is not consumed as Panerelay's interface locale

#### Scenario: Caller localizes fetch help

- **GIVEN** the caller wants Simplified Chinese CLI output
- **WHEN** the user runs `panerelay --lang zh-CN fetch bilibili --help`
- **THEN** Panerelay renders localized help
- **AND** no adapter process or browser connection is started

### Requirement: Top-level routing gives built-in commands precedence over site aliases

The Panerelay CLI SHALL resolve its built-in commands and global help/version options before considering a direct site alias. It SHALL consider only an exact installed adapter ID as a direct alias, SHALL NOT treat an unknown command or absolute URL as a direct alias, and SHALL preserve the explicit `fetch` namespace as the disambiguation path for a site ID that conflicts with a built-in command.

#### Scenario: Installed site ID conflicts with a built-in command

- **GIVEN** an installed site adapter ID equals a Panerelay built-in command
- **WHEN** the caller uses that ID as the first operand
- **THEN** the CLI selects the built-in command
- **AND** the caller can address the site only through `panerelay fetch <site> ...`

#### Scenario: Unknown top-level command is supplied

- **GIVEN** the first operand is neither a built-in command nor an installed site adapter ID
- **WHEN** the CLI resolves the invocation
- **THEN** it reports the existing localized unknown-command error
- **AND** it does not select a browser or read Bridge credentials

#### Scenario: Absolute URL omits the fetch namespace

- **GIVEN** the caller supplies an absolute HTTP or HTTPS URL as the first operand
- **WHEN** the CLI resolves the invocation
- **THEN** it does not treat the URL as a direct site alias or raw fetch
- **AND** raw browser fetch remains available through `panerelay fetch <url>`

#### Scenario: Direct command contains a site option named lang

- **GIVEN** an installed site command declares a `--lang` option
- **WHEN** the caller runs `panerelay <site> <command> --lang <value>`
- **THEN** the option is forwarded unchanged to the site command
- **AND** CLI localization remains selectable by placing global `--lang` before the site command operands

### Requirement: Panerelay CLI provides a Fetch MCP server mode

The installed Panerelay executable SHALL provide a stdio MCP mode for the bounded Panerelay Fetch tool. The mode SHALL write only MCP protocol messages to stdout, keep bounded diagnostics free of credentials, reuse existing browser selection and fetch clients, release each exact-origin session after the call, and terminate cleanly when the MCP client closes stdin.

#### Scenario: MCP client launches the stable command

- **GIVEN** Panerelay setup installed the stable host launcher and one browser is live
- **WHEN** an MCP client starts the documented Fetch MCP command and calls its tool
- **THEN** it receives a valid MCP result backed by the selected browser
- **AND** the process does not start a second Native Messaging host or print setup text to stdout

#### Scenario: MCP request is invalid

- **GIVEN** an MCP client supplies an unsupported method, URL, body, or response option
- **WHEN** Panerelay validates the call
- **THEN** it returns a bounded MCP tool error
- **AND** no fetch session or browser network request remains active
