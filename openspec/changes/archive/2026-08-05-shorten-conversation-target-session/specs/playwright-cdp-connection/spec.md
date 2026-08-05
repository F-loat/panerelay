## MODIFIED Requirements

### Requirement: Playwright conversations can attach with an exact initial target

Panerelay SHALL provide a bounded target-scoped variant of the explicit Playwright discovery URL and a compact canonical Playwright CLI session name derived reversibly from the same opaque browser and target hint for Side Panel conversation guidance. The shared derived session value MUST be no more than 64 characters and contain only the portable session-name character set accepted by the pinned browser integrations. When the target is authorized and live in the named browser, Playwright CLI 0.1.17 initial discovery SHALL place it at index `0`. A target-scoped attach MUST fail explicitly rather than assign index `0` to another page when the hint is stale, unavailable, unauthorized, malformed, or non-canonical.

#### Scenario: Target-scoped Playwright attach succeeds

- **GIVEN** the Agent invokes Playwright CLI 0.1.17 with the injected compact `-s=<session>` value and target-scoped CDP URL
- **AND** the hinted target is live and authorized in the originating browser
- **WHEN** Playwright attaches and runs `tab-list`
- **THEN** the hinted target is listed at index `0`
- **AND** `tab-select 0` and subsequent page commands address that target without URL/title matching

#### Scenario: Target-scoped Playwright attach cannot resolve the target

- **GIVEN** the hint names a closed, replaced, unauthorized, or wrong-browser target
- **WHEN** Playwright requests discovery or initializes the participant
- **THEN** Panerelay returns a bounded unavailable failure
- **AND** no different page is exposed as the hinted index `0`

#### Scenario: Target-scoped Playwright hint is malformed

- **GIVEN** the target-scoped endpoint or derived session metadata cannot decode one complete canonical current browser/target pair
- **WHEN** Playwright requests discovery
- **THEN** Panerelay rejects the attach before participant allocation
- **AND** it does not fall back to the unscoped Playwright lane

#### Scenario: Playwright session retains upstream tab behavior

- **GIVEN** target-scoped orientation completed
- **WHEN** the Agent uses normal `tab-list`, `tab-select`, `tab-new`, or `tab-close` commands in the injected Playwright session
- **THEN** Playwright retains its ordinary session-local index behavior after the initial ordering
- **AND** Panerelay retains the existing authorization, control, revocation, and browser-ownership boundaries
