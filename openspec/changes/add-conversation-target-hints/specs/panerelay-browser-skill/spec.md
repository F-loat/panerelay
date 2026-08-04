## ADDED Requirements

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
