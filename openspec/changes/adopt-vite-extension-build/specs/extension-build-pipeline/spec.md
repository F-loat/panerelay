## Purpose

Define a maintainable, manifest-driven build and source layout for Panerelay's Chrome Extension
without changing its runtime permissions or browser behavior.

## ADDED Requirements

### Requirement: Extension source reflects runtime boundaries

Panerelay SHALL organize Extension implementation by background, page, shared, and public-asset
ownership.

#### Scenario: Maintainer changes browser control

- **GIVEN** a change affects debugger attachment, authorization, or control visibility
- **WHEN** the maintainer locates the implementation
- **THEN** the service-worker entry and its helpers are under the background boundary

#### Scenario: Maintainer changes side-panel presentation

- **GIVEN** a change affects side-panel HTML, styles, or interaction
- **WHEN** the maintainer locates the implementation
- **THEN** the page entry and its colocated modules are under one side-panel boundary

### Requirement: Manifest defines build entry points

Panerelay SHALL use the MV3 manifest as the source of truth for Extension background and page entry
points.

#### Scenario: Production Extension is built

- **GIVEN** the root manifest references TypeScript and HTML source entries
- **WHEN** the maintainer runs the Extension build
- **THEN** Vite and CRXJS emit a self-contained `dist` with a valid module service worker and
  side-panel page

#### Scenario: Extension is developed locally

- **GIVEN** the unpacked development Extension is loaded from `dist`
- **WHEN** a source entry changes under the Vite development command
- **THEN** CRXJS rebuilds or reloads the affected Extension runtime without a custom file-copy
  watcher

### Requirement: Static assets remain stable

Panerelay SHALL copy public icon assets without content hashing and SHALL preserve all manifest
icon references in the built Extension.

#### Scenario: Manifest declares an icon

- **GIVEN** the Extension manifest references an icon under `icons/`
- **WHEN** the production build completes
- **THEN** the same relative icon path exists in `dist`

### Requirement: Candidate validation follows declared resources

Panerelay SHALL validate built Extension resources from manifest and HTML references rather than
assuming fixed JavaScript or CSS bundle names.

#### Scenario: Vite hashes an implementation asset

- **GIVEN** a built page references a hashed script or stylesheet
- **WHEN** release validation inspects the Extension
- **THEN** it accepts the asset only when that referenced file exists in the candidate

#### Scenario: Declared nested resource is missing

- **GIVEN** the built manifest or a declared Extension HTML page references a local resource
- **WHEN** that file is absent from `dist` or the archive
- **THEN** release validation fails and identifies the missing relative path

### Requirement: Extension review packaging is lightweight

Panerelay SHALL provide a command that builds and archives only the Chrome Extension.

#### Scenario: Maintainer requests an Extension zip

- **GIVEN** the maintainer wants to inspect or manually install the current Extension
- **WHEN** the maintainer runs the Extension packaging command
- **THEN** Panerelay writes one versioned Extension zip without producing npm tarballs, inventory,
  or checksum files

### Requirement: Build migration preserves runtime scope

Panerelay SHALL preserve the Extension identity, Chrome version floor, permissions, optional host
patterns, side-panel path, and browser-control behavior during the build migration.

#### Scenario: Built manifest is compared

- **GIVEN** the Vite-built Extension candidate
- **WHEN** maintainers inspect its manifest
- **THEN** its identity, version, permissions, and optional host access match the source manifest
  after entry-path rewriting
