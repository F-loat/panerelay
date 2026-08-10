# agent-web-fetch-routing Specification

## Purpose

Define one Agent-facing fetch tool that reuses an explicitly selected Panerelay browser's login state without exposing browser credentials or pretending to replace vendor-owned hosted tools.

## Requirements

### Requirement: Panerelay exposes a bounded browser Fetch MCP tool

Panerelay SHALL expose a bounded stdio MCP server with one fetch-only tool. Each call SHALL select exactly one live browser through existing Panerelay routing, scope its fetch session to the input URL's exact origin, use current fetch-domain and Chrome Host Permission checks, and return the structured browser-fetch response without Cookie, storage, Bridge, or session secrets. Because supported HTTP methods may mutate upstream state, the MCP definition SHALL NOT claim the tool is read-only.

#### Scenario: Agent fetches an authenticated API

- **GIVEN** one live browser is selected and the user granted the request domain
- **WHEN** an MCP client calls Panerelay Fetch with an absolute HTTP(S) URL
- **THEN** the request runs through the selected Bridge and Extension with that browser's applicable login state
- **AND** the MCP result contains only the bounded response and attached-Cookie count

#### Scenario: Agent attempts to widen a call

- **GIVEN** an MCP fetch session was created for one exact origin
- **WHEN** the request, a redirect, or browser-state binding would reach another origin
- **THEN** Panerelay fails closed before a second-origin request
- **AND** it does not create a control lease, navigate a tab, or select another browser

### Requirement: Panerelay-owned Agent conversations use Panerelay Fetch directly

Panerelay SHALL make the Fetch MCP tool available to its own Codex and Claude Code conversations. It SHALL disable Codex hosted web search for those app-server conversations and SHALL deny Claude Code `WebFetch` for those CLI turns so authenticated fetch tasks select the MCP tool directly. It SHALL leave general Claude `WebSearch` available and SHALL NOT use a failed built-in call, hook error, prompt payload, or external-runtime patch as a transport.

#### Scenario: Codex needs browser-authenticated content

- **GIVEN** Codex runs inside the Panerelay-owned app-server
- **WHEN** the model needs an HTTP resource that may depend on browser login
- **THEN** the Panerelay Fetch MCP tool is available and hosted web search is disabled for that process
- **AND** Panerelay does not claim that Codex Hooks intercepted a hosted tool

#### Scenario: Claude needs browser-authenticated content

- **GIVEN** Claude Code runs a Panerelay-owned turn
- **WHEN** the model needs to fetch an HTTP resource
- **THEN** `WebFetch` is denied and the Panerelay Fetch MCP tool is available in the same turn
- **AND** `WebSearch` and unrelated Claude tools retain their existing policy

### Requirement: External Agent routing is explicit and reversible

Panerelay SHALL document and optionally configure the same stdio MCP server for user-owned Codex and Claude Code installations only after an explicit setup selection. Setup SHALL preserve unrelated configuration, record only Panerelay-owned entries needed for removal, diagnose the effective MCP registration and native web-fetch disable rule, and reverse only those owned entries. It SHALL explain that this is native disable-plus-MCP routing rather than transparent interception.

#### Scenario: User opts into external Agent routing

- **GIVEN** a supported Codex or Claude Code executable is installed
- **WHEN** the user explicitly selects Panerelay Agent fetch integration
- **THEN** setup registers the stable Panerelay Fetch MCP command and disables that Agent's native fetch surface using its supported configuration
- **AND** no browser domain, tab, or control authorization is granted

#### Scenario: User removes external Agent routing

- **GIVEN** setup previously installed Panerelay-owned Agent fetch configuration
- **WHEN** the user removes or uninstalls that integration
- **THEN** setup removes only the matching Panerelay MCP and native-fetch routing entries
- **AND** unrelated Agent MCP servers, permissions, Skills, and settings remain unchanged
