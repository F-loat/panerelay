## MODIFIED Requirements

### Requirement: Published npm packages match the verified candidate

Panerelay SHALL publish every validated candidate tarball in dependency order, use npm distribution tag `latest` for stable and `beta` for beta, and verify that any already-published version has identical integrity before treating a retry as successful.

#### Scenario: New channel version is published

- **GIVEN** all candidate versions are absent from npm
- **WHEN** publication runs for a selected channel
- **THEN** it publishes the exact retained tarballs in protocol, browser registry, CLI, site kit, sites catalog, automation adapters, Bridge, and setup dependency order with the channel's distribution tag

#### Scenario: Publication resumes after a partial failure

- **GIVEN** an earlier attempt published only some candidate tarballs
- **WHEN** the same candidate is retried
- **THEN** the workflow skips byte-identical published tarballs and publishes the missing tarballs

#### Scenario: Immutable package content conflicts

- **GIVEN** npm already contains the selected name and version with different integrity
- **WHEN** publication preflight runs
- **THEN** the workflow fails before overwriting or accepting the conflicting package
