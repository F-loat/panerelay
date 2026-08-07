## MODIFIED Requirements

### Requirement: OpenCode availability is discovered without blocking other providers

Panerelay SHALL discover explicit, automatically persisted, PATH-based, and documented user-local OpenCode executable candidates, SHALL version-probe the selected candidate, and SHALL expose one OpenCode provider descriptor with actionable setup guidance. An explicit OpenCode executable override MUST remain authoritative. An automatically persisted discovery result MUST remain a fallback and MUST NOT prevent a live reconstructed-PATH candidate from becoming authoritative during later setup, self-update, or provider discovery. A legacy persisted OpenCode path without origin metadata MUST be treated as an automatically discovered fallback. A missing, incompatible, or unconfigured OpenCode runtime MUST NOT make the Native Host, another Agent provider, or an automation integration unhealthy.

#### Scenario: Compatible OpenCode is installed

- **GIVEN** an OpenCode executable reports a supported version and can initialize the required ACP v1 capabilities
- **WHEN** the Side Panel requests Agent providers
- **THEN** OpenCode appears as ready alongside every other available provider
- **AND** its detected version and negotiated capabilities are bounded provider metadata

#### Scenario: Live command path supersedes an automatically persisted candidate

- **GIVEN** protected runtime configuration contains an automatically discovered or legacy OpenCode path
- **AND** the reconstructed command path contains a different OpenCode executable that passes the version probe
- **AND** Codex or another provider may be the Side Panel's current selection
- **WHEN** setup, self-update, or the Side Panel performs live OpenCode discovery
- **THEN** Panerelay selects the reconstructed-PATH executable before the persisted fallback
- **AND** the all-provider availability query does not execute the stale persisted OpenCode fallback after the live candidate succeeds
- **AND** provider preparation does not start ACP through the stale persisted executable
- **AND** the resulting protected runtime record identifies the live discovery as automatically selected

#### Scenario: Explicit executable override remains authoritative

- **GIVEN** the user supplied an explicit OpenCode executable override that passes the version probe
- **AND** another OpenCode executable is present on the reconstructed command path
- **WHEN** setup, self-update, or the Side Panel performs live OpenCode discovery
- **THEN** Panerelay selects the explicit executable
- **AND** later protected runtime reads preserve its explicit origin until the user changes the override or protected configuration

#### Scenario: Persisted candidate remains a bounded fallback

- **GIVEN** protected runtime configuration contains a previously discovered OpenCode executable that still passes the version probe
- **AND** no OpenCode executable on the reconstructed command path passes the version probe
- **WHEN** the Side Panel requests Agent providers
- **THEN** Panerelay may report the persisted executable as ready
- **AND** it does not scan unbounded version-manager locations, install OpenCode, or weaken operating-system execution policy

#### Scenario: OpenCode is missing or incompatible

- **GIVEN** no OpenCode candidate can be resolved or the selected runtime cannot initialize compatible ACP behavior
- **WHEN** setup, doctor, or the Side Panel inspects Agent providers
- **THEN** OpenCode appears as optional and unavailable with installation and `opencode auth login` guidance
- **AND** other providers, browser authorization, and automation integrations remain usable
