# setup-cli-localization Specification

## Purpose

Define bilingual documentation and setup CLI behavior without making machine-readable diagnostics locale-dependent.

## Requirements

### Requirement: Primary documentation is available in English and Simplified Chinese

Panerelay SHALL provide equivalent root README entry points in English and Simplified Chinese.

#### Scenario: Reader changes documentation language

- **GIVEN** a reader opens either root README
- **WHEN** they use its language link
- **THEN** they reach the corresponding README in the other supported language

### Requirement: CLI language follows explicit and device preferences

The setup CLI SHALL support English and Simplified Chinese and SHALL select one locale for each invocation.

#### Scenario: Device locale is Chinese

- **GIVEN** neither a CLI nor environment override is present
- **WHEN** the resolved device locale is a Chinese variant
- **THEN** human-readable CLI output uses Simplified Chinese

#### Scenario: Device locale is unsupported

- **GIVEN** neither a CLI nor environment override is present
- **WHEN** the resolved device locale is neither Chinese nor English
- **THEN** human-readable CLI output falls back to English

#### Scenario: Maintainer overrides the language

- **GIVEN** a device locale differs from the desired output language
- **WHEN** the user supplies `--lang en`, `--lang zh-CN`, or `PANERELAY_LANG`
- **THEN** the explicit CLI option takes priority over the environment override and device locale

### Requirement: Human-readable setup operations are localized

Panerelay SHALL localize CLI-owned help, argument errors, setup results, uninstall interaction, and doctor presentation in the selected language.

#### Scenario: Setup action is omitted

- **GIVEN** the user invokes the setup package with setup options but no action
- **WHEN** the CLI parses the invocation
- **THEN** it runs setup with those options and identifies setup as the default action in help

#### Scenario: Chinese help is requested

- **GIVEN** the selected language is Simplified Chinese
- **WHEN** the user runs the setup CLI with `--help`
- **THEN** command descriptions, options, and usage guidance are shown in Simplified Chinese

#### Scenario: Doctor presents a known check

- **GIVEN** the selected language is Simplified Chinese
- **WHEN** doctor prints a human-readable report
- **THEN** known check labels, statuses, details, and remediation hints are localized while paths and executable names remain intact

#### Scenario: Doctor presents an actionable human report

- **GIVEN** doctor has passing, warning, and failing checks
- **WHEN** it prints a human-readable report
- **THEN** checks are grouped by environment, local integration, browser connection, and default Provider with visual status markers, remediation beside affected checks, and a final summary

### Requirement: Default Provider flags use symmetric scope names

Panerelay SHALL expose `--project-provider` and `--global-provider` for project-level and user-level default Provider configuration, and SHALL NOT accept `--project` as an alias.

#### Scenario: Project default Provider is requested

- **GIVEN** the user invokes setup or doctor with `--project-provider`
- **WHEN** the CLI parses the invocation
- **THEN** it applies project-level Provider and Agent Skill behavior

#### Scenario: Removed project alias is supplied

- **GIVEN** the user invokes the CLI with `--project`
- **WHEN** arguments are validated
- **THEN** the CLI rejects the unknown option before changing installation state

### Requirement: Machine-readable diagnostics are locale-independent

Panerelay SHALL keep `doctor --json` independent of the selected human language.

#### Scenario: Agent requests JSON diagnostics

- **GIVEN** any supported language is selected
- **WHEN** the user or Agent runs `panerelay doctor --json`
- **THEN** the report retains the same field names, check IDs, statuses, and diagnostic values
