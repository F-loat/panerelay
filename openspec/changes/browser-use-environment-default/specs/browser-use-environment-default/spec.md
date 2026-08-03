## Purpose

Make the official Browser Use CLI and CLI MCP consume Panerelay's selected connection through their normal environment configuration, without requiring a Panerelay-specific launcher or child-process wrapper.

## ADDED Requirements

### Requirement: Browser Use environment default

The Browser Use integration SHALL persist its effective Extension-mode CDP environment in a protected Browser Harness environment configuration that the official Browser Use CLI can load, including `BU_CDP_URL` and the Panerelay Browser Harness lane settings required for the integration.

#### Scenario: Extension mode affects the official CLI

- **WHEN** Browser Use is configured to use the Panerelay Extension connection and the user starts the official `browser-use` CLI without a Panerelay wrapper
- **THEN** Browser Harness SHALL resolve the configured Panerelay CDP endpoint and Browser Use SHALL operate through the selected authorized browser

#### Scenario: Direct mode removes the Panerelay environment

- **WHEN** Browser Use is configured for Direct mode
- **THEN** the integration SHALL remove or disable the Panerelay CDP environment override so the official Browser Use CLI uses its normal Direct behavior

#### Scenario: CLI MCP follows the same default

- **WHEN** a user starts the official `browser-use --cli-mcp` command after Extension mode is configured
- **THEN** the MCP process SHALL use the same Panerelay endpoint and authorization boundaries as the ordinary Browser Use CLI

### Requirement: Default configuration is bounded and protected

The integration SHALL write the Browser Use environment configuration atomically under protected user-owned storage, preserve unrelated Browser Harness settings, and never write Bridge bearer tokens, page content, cookies, prompts, screenshots, or WebSocket credentials to that configuration.

#### Scenario: Configuration update is interrupted

- **WHEN** an environment update fails before replacement is complete
- **THEN** the previous valid configuration SHALL remain usable or the integration SHALL fail closed without leaving a partially written configuration

#### Scenario: Uninstall removes only owned defaults

- **WHEN** the user uninstalls the Panerelay Browser Use integration
- **THEN** Panerelay SHALL remove only its managed environment keys and files and SHALL preserve unrelated Browser Harness configuration

### Requirement: Existing Browser Use semantics remain upstream-owned

The integration SHALL leave Browser Use helper semantics, CLI parsing, CLI MCP protocol behavior, daemon commands, and Python SDK construction to the installed Browser Use and Browser Harness versions.

#### Scenario: Ordinary helper invocation

- **WHEN** an official Browser Use helper such as `list_tabs()` or `page_info()` is run through the configured environment
- **THEN** Panerelay SHALL provide only the connection and policy boundary and SHALL not translate or reinterpret the helper command

#### Scenario: Unsupported upstream surface

- **WHEN** Browser Use requests a browser-process ownership or unsupported context operation
- **THEN** the existing explicit Panerelay unsupported-operation error SHALL be returned without falling back to Direct Chrome
