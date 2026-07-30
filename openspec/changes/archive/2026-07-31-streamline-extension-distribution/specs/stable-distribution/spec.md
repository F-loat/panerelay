## ADDED Requirements

### Requirement: Official Extension installation is Store-first

Panerelay SHALL direct normal users to install the official Extension from its Chrome Web Store listing. Documentation SHALL reserve unpacked Extension loading for workspace development, self-built distributions, rollback, and explicit candidate verification, and SHALL pair the official Store Extension with the normal setup command without embedding a Panerelay release number in permanent installation guidance. Successful setup output SHALL present the Store listing when configured for the official Extension ID and SHALL instead direct custom-ID users to load their matching Extension build.

#### Scenario: User follows the normal installation path

- **GIVEN** a user wants the official Panerelay distribution
- **WHEN** they follow the English or Chinese quickstart or setup guidance
- **THEN** the first Extension installation step links to the official Chrome Web Store listing
- **AND** the local integration step uses the unversioned setup command

#### Scenario: Official setup completes

- **GIVEN** setup resolves the official Panerelay Extension ID
- **WHEN** local integration installation succeeds
- **THEN** the localized completion output prints the official Chrome Web Store listing as the Extension next step

#### Scenario: Custom-ID setup completes

- **GIVEN** setup resolves a custom Extension ID
- **WHEN** local integration installation succeeds
- **THEN** the localized completion output directs the user to load the matching custom Extension build
- **AND** it does not direct that custom installation to the official Store build

#### Scenario: Developer works with an unpublished build

- **GIVEN** a developer is running or validating a workspace build
- **WHEN** they follow development or candidate-verification guidance
- **THEN** the documentation retains an unpacked Extension path and clearly scopes it to that non-default workflow

#### Scenario: User operates a self-built or rollback distribution

- **GIVEN** a user intentionally uses a self-built Extension or rolls back the lockstep installation
- **WHEN** they follow the exceptional installation guidance
- **THEN** the documentation allows a matching unpacked Extension and setup package without presenting it as the normal official installation path
