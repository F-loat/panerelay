## ADDED Requirements

### Requirement: Site source and GitHub lifecycle output is localized

The setup CLI SHALL localize help, source-kind labels, trust guidance, progress, validation errors, GitHub resolution failures, resolved-commit presentation, and installation results for source-form local and GitHub adapters in English and Simplified Chinese. Repository owner, name, ref, path, commit, adapter ID, version, and canonical machine-readable values SHALL remain unchanged.

#### Scenario: User requests add help in Chinese

- **GIVEN** Simplified Chinese is selected
- **WHEN** the user runs setup add help
- **THEN** help shows built-in IDs, local install sources, local source adapters, GitHub shorthand, URL, ref, and subdirectory forms in Simplified Chinese
- **AND** it states that remote adapter installation trusts and installs third-party code

#### Scenario: GitHub source resolves successfully

- **GIVEN** English is selected and a GitHub adapter is valid
- **WHEN** setup installs it
- **THEN** the result identifies the adapter, version, normalized source, and abbreviated resolved commit
- **AND** it does not print fetched source code, credentials, cookies, or Bridge state

#### Scenario: Remote validation fails in Chinese

- **GIVEN** Simplified Chinese is selected and a remote source is malformed or unsupported
- **WHEN** setup reports the failure
- **THEN** the human-readable diagnosis and remediation are localized
- **AND** repository identifiers, paths, refs, and validation field names remain canonical
