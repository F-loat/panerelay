## MODIFIED Requirements

### Requirement: Stable publication creates a GitHub Release

Panerelay SHALL create tag `v<version>` and a non-prerelease GitHub Release for a successful stable publication, attach the exact verified Extension zip and a checksum file naming only the attached public asset, omit candidate-internal inventory from the public Release, and target the workflow commit. The complete workflow artifact SHALL remain the recovery and audit source for inventory and full candidate checksums.

#### Scenario: Stable packages are published

- **GIVEN** stable validation passes, the tag and release do not already exist, and all npm packages are published or integrity-matched
- **WHEN** the stable workflow completes
- **THEN** it creates the stable tag and GitHub Release for the selected commit with the verified Extension zip and matching public checksum
- **AND** the Release does not attach `inventory.json`

#### Scenario: Public checksums are inspected

- **GIVEN** a user downloads the Extension zip and `SHA256SUMS` from the stable GitHub Release
- **WHEN** they inspect or verify the checksum file
- **THEN** it names only assets attached to that Release

#### Scenario: Stable tag or release already exists

- **GIVEN** the selected stable tag or GitHub Release already exists
- **WHEN** stable preflight runs
- **THEN** the workflow fails before publishing a new stable candidate
