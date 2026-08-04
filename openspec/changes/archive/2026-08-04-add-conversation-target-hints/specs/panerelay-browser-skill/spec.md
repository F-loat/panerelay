## ADDED Requirements

### Requirement: Skill selects one engine without enumerating alternatives

For an ordinary browser task, the Skill SHALL select exactly one automation engine before it performs readiness checks. It SHALL use an engine explicitly named by the user, otherwise a trusted registered default, then registered agent-browser, Browser Use, or Playwright CLI in that order, and SHALL recommend agent-browser when no trusted setup registration exists. It MUST inspect, invoke, set up, and diagnose only the selected engine and MUST NOT probe every supported executable or ask the user to choose an engine merely because none was named.

#### Scenario: User names an engine

- **GIVEN** the user explicitly requests Browser Use, Playwright CLI, or agent-browser
- **WHEN** the Skill selects an integration for the task
- **THEN** it selects that engine and performs no availability or setup probe for either alternative

#### Scenario: Trusted setup registrations are available

- **GIVEN** the user does not name an engine and Panerelay supplies one or more cached setup registrations
- **WHEN** the Skill selects an integration for the task
- **THEN** it selects one registered default when present, otherwise the first registered engine in agent-browser, Browser Use, and Playwright CLI priority order
- **AND** it treats only that selected registration as the ordinary-task fast path

#### Scenario: No trusted setup registration is available

- **GIVEN** the user requests ordinary browser work without naming an engine and no trusted Panerelay setup registration is supplied
- **WHEN** the Skill begins readiness handling
- **THEN** it recommends and inspects only agent-browser
- **AND** a missing agent-browser executable leads to its targeted official installation path rather than probing Browser Use or Playwright CLI or asking the user to make an engine choice

#### Scenario: Selected registration is stale

- **GIVEN** the selected registered engine fails its first direct invocation or attach
- **WHEN** the Skill handles the stale hint
- **THEN** it runs only that engine's smallest matching diagnostic or repair
- **AND** it does not silently switch to another engine

### Requirement: Skill consumes conversation target hints without guessing

When a conversation context provides a versioned Panerelay browser/target hint, the Skill SHALL use the exact engine-specific session and target-selection values supplied with that context. It SHALL use agent-browser's injected `--session` and session-local `t1`, Browser Use's unchanged `switch_tab(targetId)`, or Playwright CLI's injected `-s=<session>` and target-scoped attach followed by index `0`. It MUST NOT select a target by URL/title when an exact hint is present and MUST stop with targeted diagnostics if the hint fails.

#### Scenario: Agent uses agent-browser target guidance

- **GIVEN** a conversation includes a valid agent-browser session value for an opaque target hint
- **WHEN** the Agent performs browser work with agent-browser
- **THEN** it uses that session consistently and verifies `t1` before taking a page action

#### Scenario: Agent uses Browser Use target guidance

- **GIVEN** a conversation includes an opaque Browser Use target ID
- **WHEN** the Agent performs browser work with Browser Use
- **THEN** it calls `switch_tab` with that exact target ID before page helpers
- **AND** it keeps the existing shared Panerelay daemon lane

#### Scenario: Agent uses Playwright target guidance

- **GIVEN** a conversation includes a Playwright session and target-scoped attach URL
- **WHEN** the Agent performs browser work with Playwright CLI
- **THEN** it attaches in that session, verifies the intended page at index `0`, and selects index `0` before page actions

#### Scenario: Exact hint fails

- **GIVEN** any engine reports that the injected session, target ID, or target-scoped endpoint is stale or unavailable
- **WHEN** the Skill handles the failure
- **THEN** it reports the smallest target or authorization diagnostic
- **AND** it does not guess from matching URL/title, widen authorization, switch browsers, or silently use another engine
