## ADDED Requirements

### Requirement: Firefox automation readiness is actionable

The Extension, setup, doctor, and agent-browser Provider SHALL distinguish an uninstalled launcher, a normal Firefox start requiring restart, a missing or incompatible driver, an incompatible agent-browser, missing site/tab authorization, and a ready Firefox automation session. Guidance SHALL identify only the next user action required for the current state.

#### Scenario: Firefox needs a managed restart

- **GIVEN** Native Messaging and Agent conversations work but Firefox was started normally
- **WHEN** readiness is rendered
- **THEN** Panerelay explains that the user must close Firefox and reopen it through the installed Panerelay launcher
- **AND** it does not describe setup, Native Messaging, or tab authorization as broken

#### Scenario: agent-browser needs an upgrade

- **GIVEN** Firefox automation and authorization are ready but the installed agent-browser accepts only CDP browser providers
- **WHEN** setup, doctor, or the Provider evaluates readiness
- **THEN** Panerelay reports the detected version and the minimum Firefox-WebDriver-compatible version
- **AND** it leaves Chromium automation readiness unchanged

#### Scenario: Firefox is ready but the tab is not authorized

- **GIVEN** the managed Firefox transport and compatible agent-browser are ready
- **WHEN** the user views browser settings for an eligible unauthorized tab
- **THEN** Panerelay shows the explicit current-tab and supported all-tabs authorization controls
- **AND** it does not acquire a control lease until the user authorizes a scope and agent-browser connects

#### Scenario: Firefox automation is ready

- **GIVEN** the launcher, browser, driver, relay, compatible agent-browser, site permission, and tab authorization are ready
- **WHEN** readiness is rendered
- **THEN** Panerelay reports Firefox automation available with visible release controls and no restart or installation warning
