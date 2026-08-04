# opencode-agent-provider Specification

## Purpose

Define how Panerelay exposes a user-installed OpenCode CLI as an optional ACP-backed Side Panel Agent while preserving provider-neutral conversation, approval, browser-authorization, and lifecycle boundaries.

## Requirements

### Requirement: OpenCode availability is discovered without blocking other providers

Panerelay SHALL discover configured, persisted, PATH-based, and documented user-local OpenCode executable candidates, SHALL version-probe the selected candidate, and SHALL expose one OpenCode provider descriptor with actionable setup guidance. A missing, incompatible, or unconfigured OpenCode runtime MUST NOT make the Native Host, another Agent provider, or an automation integration unhealthy.

#### Scenario: Compatible OpenCode is installed

- **GIVEN** an OpenCode executable reports a supported version and can initialize the required ACP v1 capabilities
- **WHEN** the Side Panel requests Agent providers
- **THEN** OpenCode appears as ready alongside every other available provider
- **AND** its detected version and negotiated capabilities are bounded provider metadata

#### Scenario: OpenCode is missing or incompatible

- **GIVEN** no OpenCode candidate can be resolved or the selected runtime cannot initialize compatible ACP behavior
- **WHEN** setup, doctor, or the Side Panel inspects Agent providers
- **THEN** OpenCode appears as optional and unavailable with installation and `opencode auth login` guidance
- **AND** other providers, browser authorization, and automation integrations remain usable

### Requirement: OpenCode conversations use capability-negotiated ACP sessions

Panerelay SHALL start, list, load or resume, prompt, interrupt, and close OpenCode conversations only when the installed runtime advertises the corresponding ACP capability. Panerelay SHALL preserve the canonical project directory associated with every listed or created OpenCode session and SHALL fail an unsupported or directory-mismatched operation explicitly.

#### Scenario: Start and prompt an OpenCode conversation

- **GIVEN** OpenCode initialized compatible ACP and the user selected a valid project directory
- **WHEN** the user starts a conversation and sends text or supported images
- **THEN** Panerelay creates an ACP session in that directory, sends only the bounded prompt inputs, and correlates the resulting turn with the Panerelay conversation

#### Scenario: Resume listed OpenCode history

- **GIVEN** OpenCode lists a conversation with its project directory and advertises load or resume support
- **WHEN** the user resumes that conversation later in the same Bridge process
- **THEN** Panerelay loads or resumes it with the recorded canonical directory and returns its normalized bounded history

#### Scenario: Runtime cannot perform a requested session operation

- **GIVEN** the installed OpenCode runtime does not advertise listing, image input, load, resume, close, or another requested capability
- **WHEN** the Side Panel requests that operation
- **THEN** Panerelay rejects it without fabricating a result, widening inputs, or exposing a provider-native payload

### Requirement: OpenCode events are provider neutral at the Extension boundary

Panerelay SHALL normalize OpenCode assistant text, reasoning, tool activity, usage, completion, cancellation, and bounded errors into the shared conversation event model before sending them to the Extension. Unknown ACP updates SHALL be ignored with a sanitized diagnostic or SHALL fail the affected operation, and MUST NOT cross Native Messaging as raw objects.

#### Scenario: OpenCode streams a turn

- **GIVEN** an active OpenCode prompt emits message, thought, tool, and usage updates
- **WHEN** Panerelay forwards the turn to the Side Panel
- **THEN** the panel receives bounded normalized events associated with the correct conversation and turn

#### Scenario: OpenCode emits an unknown update

- **GIVEN** an OpenCode version emits an ACP update Panerelay does not normalize
- **WHEN** the Bridge receives it
- **THEN** Panerelay does not expose the raw update or claim successful normalized behavior

### Requirement: OpenCode permission requests remain user controlled

Panerelay SHALL translate supported OpenCode ACP permission options into explicit Side Panel approval decisions, SHALL correlate exactly one response to the pending request, and SHALL cancel unanswered requests when the turn, session, provider process, or Bridge ends. An unrepresentable permission shape SHALL fail closed.

#### Scenario: User approves one OpenCode operation

- **GIVEN** OpenCode requests permission with a supported one-time approval option
- **WHEN** the user selects that decision in the current Side Panel conversation
- **THEN** Panerelay returns only the correlated ACP option identifier and marks the approval resolved

#### Scenario: Permission cannot be represented safely

- **GIVEN** OpenCode requests permission without a safely normalized decision
- **WHEN** the Bridge evaluates the request
- **THEN** it cancels or rejects the request instead of selecting a broader permission

#### Scenario: OpenCode exits with permission pending

- **GIVEN** an OpenCode permission request has no answer
- **WHEN** the user interrupts, the ACP process exits, or the Bridge shuts down
- **THEN** Panerelay cancels the request and no stale approval can continue the turn

### Requirement: OpenCode browser tools retain independent ownership

Panerelay SHALL NOT inject agent-browser, Browser Use, a Skill, browser instructions, or an MCP server into an OpenCode conversation. OpenCode SHALL receive its normal Agent configuration, and any user-configured browser tool connecting through Panerelay SHALL remain subject to the existing browser-local authorization, routing, control-lease, liveness, and revocation boundaries.

#### Scenario: OpenCode has no configured browser tool

- **GIVEN** OpenCode is ready and its own configuration contains no Panerelay-compatible browser integration
- **WHEN** Panerelay starts or resumes a Side Panel conversation
- **THEN** the ACP session receives no injected browser integration
- **AND** ordinary OpenCode conversation behavior remains available

#### Scenario: OpenCode uses its own browser configuration

- **GIVEN** the user configured a supported browser tool directly in OpenCode
- **WHEN** that tool connects through Panerelay
- **THEN** the selected browser still requires explicit site and tab authorization plus a current control lease for mutations
- **AND** Panerelay does not rewrite, transfer, retain, or infer ownership of the tool process or participant

#### Scenario: User revokes browser authorization during an OpenCode turn

- **GIVEN** an OpenCode-owned browser participant is using an authorized target
- **WHEN** the user releases control or revokes the target authorization
- **THEN** the existing Bridge and Extension revocation path removes that browser authority immediately
- **AND** the OpenCode conversation does not restore or migrate it

### Requirement: Provider selection includes OpenCode without weakening isolation

Panerelay SHALL keep OpenCode visible in the build-supported Agent catalog regardless of installation state, SHALL prefer a ready provider for a new unpinned selection, and SHALL route every OpenCode conversation operation only to the OpenCode provider that owns it. Selecting OpenCode MUST NOT change browser authorization.

#### Scenario: OpenCode and another provider are ready

- **GIVEN** OpenCode and at least one other Agent provider are ready
- **WHEN** the user selects OpenCode and starts a conversation
- **THEN** the conversation uses OpenCode while existing browser authorization remains unchanged

#### Scenario: Provider selector contains available and unavailable Agents

- **GIVEN** the build-supported Agent catalog contains both ready and unavailable providers
- **WHEN** the user opens the provider selector
- **THEN** every ready provider appears before every unavailable provider
- **AND** providers within each availability group retain the stable build-supported catalog order

#### Scenario: User selects unavailable OpenCode

- **GIVEN** OpenCode is supported by the build but unavailable locally
- **WHEN** the user selects it
- **THEN** the Side Panel shows structured OpenCode installation, authentication, and documentation guidance
- **AND** conversation actions remain disabled while the browser-authorization surface remains available

#### Scenario: Conversation provider does not match

- **GIVEN** a conversation belongs to OpenCode
- **WHEN** a request presents its identifier to another provider
- **THEN** Panerelay fails before provider access without leaking or mutating the OpenCode session
