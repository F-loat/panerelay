## ADDED Requirements

### Requirement: Stable packages do not bundle the optional Claude runtime

Panerelay's stable npm packages SHALL NOT depend on or contain the Claude Agent SDK, its platform-specific binaries, or another bundled Claude runtime. Claude Code SHALL remain a user-owned optional CLI discovered at runtime.

#### Scenario: A normal user installs Panerelay setup

- **GIVEN** a user installs `@panerelay/setup` without enabling Claude Code
- **WHEN** the package manager resolves and unpacks Panerelay dependencies
- **THEN** no Claude Agent SDK or platform-specific Claude binary is installed through Panerelay

#### Scenario: Release artifacts are inspected

- **GIVEN** a maintainer prepares a stable or beta candidate
- **WHEN** release validation inspects package manifests, tarball entries, and production dependencies
- **THEN** it rejects any packaged Claude Agent SDK or platform-specific Claude runtime
- **AND** it verifies the documented Claude Code CLI compatibility floor instead

#### Scenario: A user explicitly enables Claude Code

- **GIVEN** the user has explicitly installed and authenticated a supported Claude Code CLI
- **WHEN** setup discovers that executable
- **THEN** Panerelay can enable the Claude Provider without installing another Claude runtime
