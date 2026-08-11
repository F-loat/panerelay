# panerelay-cli Specification

## Purpose

Define an engine-neutral Panerelay command-line interface for recurring local browser administration without turning the one-time setup package into a persistent user command.

## Requirements

### Requirement: Panerelay provides a standalone administration CLI

Panerelay SHALL publish `@panerelay/cli` with the executable name `panerelay`. Base Setup SHALL provide the normal global installation. The CLI SHALL expose recurring browser-authenticated Fetch, installed site commands, connected-browser listing and selection, and installed connection-mode selection without embedding an automation engine or implementing browser automation commands. It SHALL NOT expose child-process wrappers, one-shot connection-material resolution, or a CLI command for clearing the saved browser default.

#### Scenario: Base Setup provides the CLI

- **GIVEN** the user follows the documented base Setup path
- **WHEN** Setup completes without `--no-cli`
- **THEN** the global `panerelay` command is available for Fetch, site adapters, browser listing and selection, and connection-mode selection
- **AND** Setup does not install an upstream automation engine

#### Scenario: Removed low-level command is requested

- **GIVEN** the user invokes `panerelay browser clear`, `panerelay connection resolve`, or `panerelay run`
- **WHEN** the CLI parses the invocation
- **THEN** it rejects the removed command as unknown
- **AND** it does not select a browser, resolve connection material, start a child process, or change saved state

#### Scenario: Help presents the supported product path

- **GIVEN** the user invokes `panerelay`, `panerelay -h`, or `panerelay --help`
- **WHEN** localized help is rendered
- **THEN** it presents site adapters, browser-authenticated Fetch, connected-browser selection, base Setup, and `setup add`
- **AND** it omits removed commands and temporary `npx @panerelay/cli` usage

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

The CLI SHALL allow a user to save a supported Direct or Extension mode for one installed connection adapter. Saving a mode SHALL update only Panerelay-owned preference and integration environment state, SHALL NOT resolve or print short-lived connection material, and SHALL NOT start an automation process. Browser Use Extension mode SHALL select the fixed Panerelay gateway through its managed environment; Direct mode SHALL remove only Panerelay-managed Browser Harness environment keys.

#### Scenario: User selects Browser Use Extension mode

- **GIVEN** the Browser Use integration is installed
- **WHEN** the user runs `panerelay connection use browser-use extension`
- **THEN** Panerelay saves Extension mode and writes the fixed gateway environment owned by the integration
- **AND** it does not select a browser, mint a bootstrap ticket, or start Browser Use

#### Scenario: User selects Browser Use Direct mode

- **GIVEN** the Browser Use integration is installed in Extension mode
- **WHEN** the user runs `panerelay connection use browser-use direct`
- **THEN** Panerelay saves Direct mode and removes only the Panerelay-managed Browser Harness environment keys
- **AND** it leaves unrelated Browser Use state unchanged

### Requirement: Browser administration is localized and bounded

The Panerelay CLI SHALL support English and Simplified Chinese human-readable help, argument errors, browser listings, and browser-selection results. It SHALL expose only bounded registration metadata and SHALL NOT print bearer credentials or change permissions, targets, participants, or control leases. Clearing a saved browser default SHALL remain available through the Extension settings surface rather than a CLI command.

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

#### Scenario: User clears the default in Extension settings

- **GIVEN** the current browser is the saved default
- **WHEN** the user clears that setting in the Panerelay Extension
- **THEN** the saved routing preference is removed
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
