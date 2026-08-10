## Purpose

Define a deterministic and fail-closed bulk build contract for the lockstep built-in site-adapter catalog while preserving the public single-site authoring workflow and strict installed artifact format.

## ADDED Requirements

### Requirement: Catalog builds validate selected adapters as one batch

The site toolkit SHALL support building a bounded explicit collection of source adapters as one catalog operation. The operation SHALL apply the same source-shape, static metadata, import-boundary, restricted type, generated-runtime, manifest, and artifact-size validation required by a single-site build to every selected adapter. Duplicate adapter IDs, duplicate output locations, an empty selection, or any invalid source SHALL fail the catalog operation.

#### Scenario: Valid built-in catalog is built

- **GIVEN** every selected built-in source adapter satisfies the public site-toolkit contract
- **WHEN** the catalog build runs
- **THEN** it produces one strict two-file installed directory for every selected adapter
- **AND** every generated directory passes the ordinary installed-adapter validator

#### Scenario: One selected source is invalid

- **GIVEN** one selected adapter violates a source, import, type, manifest, or artifact bound
- **WHEN** the catalog build runs
- **THEN** the complete catalog operation fails with the offending adapter identified
- **AND** no invalid or partially validated catalog is published

### Requirement: Catalog publication is atomic and exact

The catalog build SHALL stage and validate the complete selected catalog before replacing its destination. A successful destination SHALL contain exactly one directory per selected adapter and exactly the two declared installed artifacts in each directory. A failed replacement SHALL preserve or restore the previously complete destination, and temporary staging or backup directories SHALL be removed after success or recoverable failure.

#### Scenario: Catalog replacement succeeds

- **GIVEN** an existing catalog destination and a fully valid newly staged catalog
- **WHEN** publication completes
- **THEN** readers observe the complete new catalog with no stale adapter directories
- **AND** no staging or backup directory remains

#### Scenario: Build fails before publication

- **GIVEN** an existing valid catalog destination and one new adapter that fails validation
- **WHEN** the replacement build is attempted
- **THEN** the existing catalog remains unchanged and usable
- **AND** no partial new adapter output appears in the destination

### Requirement: Catalog identity has one authoritative definition

The built-in package SHALL use one authoritative ordered adapter-ID definition for its public ID list, source-directory mapping, catalog build inputs, and catalog coverage tests. The package SHALL reject a source whose declared adapter ID does not match its authoritative catalog entry.

#### Scenario: Catalog export and built artifacts are compared

- **GIVEN** the built-in sites package has completed its catalog build
- **WHEN** catalog coverage is validated
- **THEN** the exported IDs, exported source mapping, and generated adapter directories contain the same IDs in deterministic order
- **AND** an unlisted source directory is not implicitly published

### Requirement: Single-site tooling remains independently usable

The public single-site check and build operations SHALL retain their existing validation, output, and failure behavior for local and remote source adapters. They SHALL NOT require the built-in catalog, mutate a catalog destination, or weaken validation to share the bulk implementation.

#### Scenario: External author builds one adapter

- **GIVEN** a valid standalone source adapter outside the built-in package
- **WHEN** the author runs the public single-site build operation
- **THEN** it produces the same strict manifest and self-contained executable format as before
- **AND** no built-in catalog source or output is required

### Requirement: Workspace validation builds the catalog once

The repository's full validation command SHALL build workspace packages in dependency order once, then run package typechecks and compiled tests without package test scripts rebuilding the catalog. Package-local test commands MAY remain self-contained, but a package build SHALL build only that package and SHALL NOT invoke another package's build script directly.

#### Scenario: Full repository validation runs

- **GIVEN** a clean workspace with dependencies installed
- **WHEN** the root validation command executes
- **THEN** the built-in adapter catalog build is invoked exactly once
- **AND** every package typecheck, compiled test suite, and build validation still runs

### Requirement: Published sites package omits redundant source emission

The built-in sites package SHALL publish its runtime catalog API, the strict generated adapter catalog, and required package metadata without publishing redundant JavaScript or declaration trees compiled from individual adapter source directories. Package tests and release validation SHALL verify the resulting public entry and every built-in two-file adapter artifact.

#### Scenario: Sites package tarball is inspected

- **GIVEN** the built-in sites package has been packed for validation
- **WHEN** its files are enumerated
- **THEN** the package contains the public runtime entry and every selected adapter's manifest and executable
- **AND** it contains no separately compiled per-site source tree or compiled test file
