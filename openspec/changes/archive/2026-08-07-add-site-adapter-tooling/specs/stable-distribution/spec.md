## ADDED Requirements

### Requirement: Stable distribution includes the public site toolkit

Panerelay SHALL publish `@panerelay/site-kit` with the same lockstep stable or beta version as the protocol, sites catalog, setup, and CLI packages. Release validation SHALL inspect its public API, executable help/version behavior, minimal scaffold, source check, deterministic two-file build, packed contents, and consumption from an isolated project without workspace links.

#### Scenario: Stable candidate contains site tooling

- **GIVEN** a stable or beta candidate is prepared
- **WHEN** release validation inspects package identities and retained tarballs
- **THEN** site-kit has the same selected release version and dependency identities as the other lockstep packages
- **AND** its packed artifact contains only documented runtime, types, metadata, README, and license content

#### Scenario: Packed author workflow is exercised

- **GIVEN** release validation installs the retained site-kit tarball in an isolated project
- **WHEN** it scaffolds, checks, and builds the minimal adapter
- **THEN** the generated manifest and entry pass the public adapter protocol validation
- **AND** the workflow does not depend on Panerelay workspace source or generated workspace output
