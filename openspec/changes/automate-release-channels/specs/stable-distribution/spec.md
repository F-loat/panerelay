## MODIFIED Requirements

### Requirement: Stable artifacts have one release identity

Panerelay SHALL keep the repository's plain semantic version authoritative for stable releases. Stable candidates SHALL use that version across every publishable package, the Extension `version_name`, and retained inventory. An explicitly selected beta workflow SHALL instead derive one unique prerelease version from the repository version and workflow run identity and apply it consistently only in the temporary runner workspace.

#### Scenario: Stable candidate metadata is aligned

- **GIVEN** a maintainer prepares a stable candidate
- **WHEN** release validation reads package, Extension, and release metadata
- **THEN** every distributable artifact identifies the repository's plain semantic version

#### Scenario: Beta candidate metadata is aligned

- **GIVEN** a maintainer dispatches the beta publication workflow
- **WHEN** release validation reads the temporarily prepared package, Extension, and release metadata
- **THEN** every distributable artifact identifies the same derived beta version
- **AND** the repository source version remains unchanged after preparation

#### Scenario: Channel or lockstep metadata drifts

- **GIVEN** one package, Extension field, candidate entry, or selected channel does not match the expected release identity
- **WHEN** release validation runs
- **THEN** it fails before accepting or publishing the candidate
