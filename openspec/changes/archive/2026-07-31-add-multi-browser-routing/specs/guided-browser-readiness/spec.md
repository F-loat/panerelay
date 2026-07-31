## ADDED Requirements

### Requirement: Extension settings manage the browser-local routing default

When the Native Host has registered the current browser, the Extension SHALL show whether that browser is the saved agent-browser default and SHALL let the user make it the default or clear it when it owns the current value. The setting SHALL identify the current browser family and SHALL remain separate from Provider-default and permission settings.

#### Scenario: Current browser becomes the default

- **GIVEN** Chrome and Edge are registered
- **AND** the current Extension runs in Edge
- **WHEN** the user makes this browser the agent-browser default
- **THEN** Panerelay saves Edge's opaque registration ID
- **AND** it does not grant Edge site access, authorize tabs, or change the default Provider

#### Scenario: Current browser owns the default

- **GIVEN** the current Extension's browser registration is the saved default
- **WHEN** Extension settings render
- **THEN** the browser-default control identifies the current browser family and shows the enabled state
- **AND** the user can clear that saved default

#### Scenario: Another browser owns the default

- **GIVEN** another live browser registration is the saved default
- **WHEN** Extension settings render in the current browser
- **THEN** the browser-default control shows the current browser as disabled
- **AND** activating it replaces the saved default only after the user's explicit action

#### Scenario: Current browser is not registered

- **GIVEN** the Extension has not completed Native Host browser registration
- **WHEN** Extension settings render
- **THEN** the browser-default control is unavailable
- **AND** it does not infer ownership from browser focus or family alone
