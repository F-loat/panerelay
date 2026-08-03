## ADDED Requirements

### Requirement: The setup-managed Browser Use launcher is a dedicated Browser Use entry point

The setup-managed launcher SHALL be named `panerelay-browser-use` and SHALL invoke the configured Browser Use executable through the existing internal adapter dispatch when called with no command-line arguments. It SHALL preserve stdin unchanged, use the saved connection mode and saved browser routing default, and forward the Browser Use process's exit status and output. It SHALL NOT expose a Browser selector of its own; browser selection SHALL remain managed by the unified Panerelay CLI. Durable connection mode selection SHALL remain available through `panerelay connection use browser-use <direct|extension>`.

#### Scenario: No-argument launcher starts Browser Use

- **GIVEN** setup has installed a supported Browser Use executable and registered the Browser Use adapter
- **WHEN** the user invokes `panerelay-browser-use` with a Browser Use stdin script and no arguments
- **THEN** the launcher runs that executable through the Browser Use adapter
- **AND** the saved Direct or Extension mode and browser selection apply
- **AND** the stdin script reaches Browser Use unchanged

#### Scenario: Browser selection remains unified

- **GIVEN** the user wants to change the browser used by Browser Use
- **WHEN** the user runs `panerelay browser use <family-or-registration>`
- **THEN** the next no-argument `panerelay-browser-use` invocation uses that saved browser

#### Scenario: Missing configured executable fails closed

- **GIVEN** the setup-managed launcher has no configured Browser Use executable
- **WHEN** the user invokes `panerelay-browser-use` with no arguments
- **THEN** it reports an unavailable integration and does not start an arbitrary executable from `PATH`

#### Scenario: Shorthand does not bypass Panerelay boundaries

- **GIVEN** the saved mode is Extension
- **WHEN** the no-argument launcher starts Browser Use
- **THEN** it uses the same adapter, authorization, protected runtime, concurrency, and lifecycle path as the previous explicit adapter invocation
