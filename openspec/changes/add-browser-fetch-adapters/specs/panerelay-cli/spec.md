## ADDED Requirements

### Requirement: Panerelay CLI provides browser-backed fetch

The standalone `panerelay` CLI SHALL provide `fetch` as a recurring local command in addition to browser administration and automation-adapter dispatch. A URL first operand SHALL invoke raw browser fetch, while an installed site ID first operand SHALL dispatch that site's fetch adapter. Fetch SHALL reuse existing browser selection, localization, and credential non-disclosure behavior without implementing page automation semantics.

#### Scenario: Caller fetches a URL

- **GIVEN** one live browser can be selected
- **WHEN** the user runs `panerelay fetch https://example.com/api`
- **THEN** the CLI prints the structured result from that browser-backed request
- **AND** it does not attach, navigate, focus, or control a browser tab

#### Scenario: Caller selects a browser explicitly

- **GIVEN** multiple live browsers are registered
- **WHEN** the user supplies `--browser <selector>` to a raw or adapter-backed fetch
- **THEN** the explicit selector takes priority for that invocation
- **AND** the saved browser default remains unchanged

#### Scenario: First operand is ambiguous text

- **GIVEN** a first operand is neither an absolute HTTP or HTTPS URL nor an installed site adapter ID
- **WHEN** the CLI parses the fetch invocation
- **THEN** it fails with localized guidance showing raw URL and installed-adapter forms
- **AND** it does not read Bridge credentials

### Requirement: Raw fetch options follow familiar request conventions

The CLI SHALL accept `--method`, repeated `--header` or `-H`, repeated `--query`, `--data`, `--data-base64`, `--response`, `--timeout`, `--cookies`, `--no-cookies`, and `--browser` options. Header and query options SHALL accept `name:value` input without discarding values that contain additional colons, and mutually exclusive body or cookie options SHALL fail before a request is sent.

#### Scenario: Origin and Referer are customized

- **GIVEN** the target origin is authorized in Chrome
- **WHEN** the user supplies `-H 'Origin: https://www.bilibili.com' -H 'Referer: https://www.bilibili.com/'`
- **THEN** the raw fetch request preserves both values

#### Scenario: Help is requested without a browser

- **GIVEN** no browser is connected
- **WHEN** the user runs `panerelay fetch --help`
- **THEN** the CLI prints localized fetch usage and installed site metadata successfully
- **AND** it does not require or probe a Bridge connection

### Requirement: Adapter command options take precedence after the command operand

For adapter invocations, Panerelay SHALL treat options after `<site> <command>` as site-command arguments when declared by that command's manifest. In particular, `--lang` after `bilibili subtitle` SHALL select a subtitle language, while Panerelay interface localization SHALL remain available by placing global `--lang` before the `fetch` command or before the site command operands.

#### Scenario: Caller selects a subtitle language

- **GIVEN** the installed Bilibili `subtitle` command declares a `lang` option
- **WHEN** the user runs `panerelay fetch bilibili subtitle <bvid> --lang zh-CN`
- **THEN** `zh-CN` is forwarded to the adapter as the subtitle language
- **AND** it is not consumed as Panerelay's interface locale

#### Scenario: Caller localizes fetch help

- **GIVEN** the caller wants Simplified Chinese CLI output
- **WHEN** the user runs `panerelay --lang zh-CN fetch bilibili --help`
- **THEN** Panerelay renders localized help
- **AND** no adapter process or browser connection is started
