## Purpose

Define complete OpenCLI site inventory coverage, fetch-compatible adapter migration, isolated E2E evidence, and explicit classification of behavior outside Panerelay's browser-fetch boundary.

## ADDED Requirements

### Requirement: Every OpenCLI site is accounted for

The migration inventory SHALL contain every non-internal directory currently present under the authoritative OpenCLI `clis` directory exactly once, and SHALL identify either the Panerelay adapter location and supported commands or an explicit Pending/Unsupported reason.

#### Scenario: Inventory is refreshed

- **GIVEN** a non-internal OpenCLI site directory exists
- **WHEN** the migration inventory is reviewed
- **THEN** the site appears exactly once
- **AND** its status agrees with the Panerelay built-in catalog and documented evidence

#### Scenario: A site is not fetch-compatible

- **GIVEN** the authoritative adapter requires page navigation, DOM/page JavaScript, request interception, desktop/native control, or an unavailable authenticated workflow
- **WHEN** it cannot be represented by the current fetch adapter boundary
- **THEN** the inventory records the concrete source behavior and keeps the site Pending or marks it Unsupported only when the evidence meets the status rule

### Requirement: Fetch-compatible commands use the public site contract

Every migrated site SHALL use `panerelay.site.ts` plus command-per-file `defineCommand` modules and SHALL be included in the aggregate built-in catalog. A migrated command SHALL return structured JSON through the existing `SiteCommandContext.fetch` path and SHALL not import OpenCLI runtime code.

#### Scenario: Public HTTP adapter is migrated

- **GIVEN** an OpenCLI command uses a stable public HTTP or cookie-backed request that fits RFC-0009 bounds
- **WHEN** it is migrated
- **THEN** its Panerelay source declares typed arguments, access, output, and examples
- **AND** it builds into the strict two-file installed form

#### Scenario: Only part of a site is compatible

- **GIVEN** a site contains both fetch-compatible and page/native-only commands
- **WHEN** the compatible commands are migrated
- **THEN** the inventory lists the supported subset
- **AND** the omitted commands and their boundary reason remain documented

### Requirement: Each migrated site has isolated live evidence

After a site is added to the catalog, its E2E SHALL be runnable by selecting that site alone, and the migration record SHALL retain a bounded pass/fail/blocked result and date without retaining page content, cookies, credentials, request bodies, screenshots, or machine-specific identifiers.

#### Scenario: Single-site E2E succeeds

- **GIVEN** the required browser registration, domain grant, and upstream access are available
- **WHEN** the site-only E2E selector is run
- **THEN** the selected site's representative command returns valid structured output
- **AND** no other site's E2E cases are executed

#### Scenario: Single-site E2E cannot run

- **GIVEN** authorization, login, upstream availability, or a documented capability prevents a complete run
- **WHEN** the site-only E2E is attempted
- **THEN** the result is recorded as blocked or failed with a concise reason
- **AND** the inventory does not claim the site is fully verified

### Requirement: Migrated adapter IDs preserve canonical site names

A migrated adapter ID SHALL accept a lowercase ASCII letter or digit as its first character and lowercase ASCII letters, digits, or hyphens thereafter. Command, argument, and protected-binding identifiers SHALL retain their existing lowercase-letter first-character rule. A numeric-leading OpenCLI site name SHALL be used directly instead of introducing a word-prefixed internal ID or compatibility alias.

#### Scenario: Numeric-leading site is migrated

- **GIVEN** an authoritative OpenCLI site is named `12306` or `36kr`
- **WHEN** it is registered as a Panerelay built-in
- **THEN** its manifest, source directory, catalog ID, installed registry ID, CLI route, and E2E selector use that exact site name
- **AND** the former `rail12306` or `kr36` ID is not retained

#### Scenario: Non-site identifier begins with a digit

- **GIVEN** a command, argument, or protected binding name begins with a digit
- **WHEN** its manifest or source definition is validated
- **THEN** validation rejects it under the existing identifier rule
