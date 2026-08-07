## ADDED Requirements

### Requirement: Browser fetch requires explicit domain authorization

Panerelay SHALL authorize browser fetch independently from browser tab authorization and control ownership. Before reading browser cookies, installing request-header rules, or issuing network traffic, the Extension SHALL require either a saved domain pattern matching the final target hostname or an explicit all-domains grant. Domain grants SHALL be independent from URL scheme and port. An exact pattern such as `api.baidu.com` SHALL match only that hostname, while a wildcard pattern such as `*.baidu.com` SHALL match `baidu.com` and every subdomain. Chrome Host Permission SHALL remain a separate mandatory condition, and neither permission SHALL imply tab authorization, debugger attachment, focus, or a control lease.

#### Scenario: Exact domain is authorized

- **GIVEN** the user saved a fetch grant for `api.example.com` and Chrome holds Host Permission for the target URL
- **WHEN** an authenticated fetch session requests `https://api.example.com/items`
- **THEN** the Extension may prepare and issue the request
- **AND** sibling hostnames and subdomains remain unauthorized unless separately granted

#### Scenario: Wildcard domain is authorized

- **GIVEN** the user saved `*.baidu.com`
- **WHEN** a caller requests browser fetch for `https://map.baidu.com/items`, `http://baidu.com/items`, or either hostname on a non-default port
- **THEN** the domain policy authorizes each request independent of scheme and port
- **AND** `notbaidu.com` remains unauthorized

#### Scenario: Target domain is unauthorized

- **GIVEN** no saved domain pattern matches the target hostname and the all-domains grant is disabled
- **WHEN** a caller requests browser fetch for that domain
- **THEN** the Extension rejects the request before reading cookies, installing header rules, or issuing network traffic
- **AND** the error identifies only the target origin and the explicit Agent authorization command

#### Scenario: Browser control is already authorized

- **GIVEN** the current tab or all browser tabs are authorized for Agent control
- **AND** the target origin has no fetch-domain grant
- **WHEN** a caller requests browser fetch for that origin
- **THEN** the fetch remains unauthorized
- **AND** existing tab authorization and control state remain unchanged

### Requirement: Users can grant and manage fetch origins

The Extension side panel SHALL let the user grant fetch access to the active tab's current hostname or to all domains through a direct user gesture. Agent and management input SHALL accept an exact hostname, a leading `*.` wildcard domain, or a URL of any parseable scheme and normalize URLs to their hostname. It SHALL expose the all-domains state separately from an expandable, deterministic list of saved domain patterns, and SHALL let the user revoke each Panerelay grant immediately without automatically removing Chrome Host Permission that another Panerelay capability may still require.

#### Scenario: User grants the current domain

- **GIVEN** the active tab is an eligible HTTP(S) page
- **WHEN** the user selects current-domain fetch access and Chrome accepts the corresponding HTTP and HTTPS Host Permission patterns
- **THEN** the current hostname is saved as a Panerelay fetch grant
- **AND** the side panel shows it in the expandable authorized-domain list

#### Scenario: User grants all domains

- **GIVEN** the all-domains fetch grant is disabled
- **WHEN** the user selects all-domain fetch access and Chrome accepts both HTTP and HTTPS Host Permission patterns
- **THEN** the all-domains grant becomes active
- **AND** the current-domain control is no longer highlighted while all-domains access is active
- **AND** existing domain-pattern grants remain available for use if the all-domains grant is later disabled

#### Scenario: User switches from all domains to the current domain

- **GIVEN** the all-domains fetch grant is active
- **WHEN** the user selects current-domain fetch access
- **THEN** the Extension ensures that the active hostname is saved before disabling the all-domains grant
- **AND** the current-domain control becomes highlighted while the all-domains control is no longer highlighted

#### Scenario: User revokes an exact grant

- **GIVEN** a domain pattern appears in the saved fetch grant list
- **WHEN** the user revokes that pattern
- **THEN** subsequent fetch requests matching only that pattern fail closed unless another pattern or the all-domains grant applies
- **AND** the Extension does not remove Chrome Host Permission as a side effect

#### Scenario: Chrome Host Permission is removed externally

- **GIVEN** a Panerelay fetch grant remains saved but Chrome Host Permission for it is removed
- **WHEN** a caller performs browser fetch for that origin
- **THEN** Chrome access failure stops the request explicitly
- **AND** no tab authorization or control state is widened or inferred

### Requirement: Agents can request user-approved fetch authorization

The CLI SHALL expose an explicit Agent-callable fetch authorization command accepting one exact hostname, one leading-wildcard domain pattern, or a URL of any parseable scheme normalized to its hostname. The selected Bridge SHALL correlate the normalized domain request to the selected browser identity and generation, and the Extension SHALL open one focused confirmation window that offers only deny and requested-domain approval. Only a user click in that window SHALL request Chrome Host Permission and persist the corresponding domain grant; all-domains approval SHALL remain a side-panel-only action. Denial, close, timeout, disconnect, duplicate settlement, or generation change SHALL fail closed.

#### Scenario: Agent requests domain approval

- **GIVEN** an Agent receives a permission-required fetch error for `https://api.example.com`
- **WHEN** it runs the documented authorization command with that URL, `api.example.com`, or `*.example.com` and the user approves the normalized pattern
- **THEN** the command returns a bounded granted result naming the domain scope and normalized pattern
- **AND** a matching retry can proceed if the selected browser generation is still current

#### Scenario: User explicitly denies the request

- **GIVEN** an Agent authorization confirmation is open
- **WHEN** the user explicitly denies it
- **THEN** the Agent command returns a denied result
- **AND** the identical saved Panerelay domain pattern is removed if present
- **AND** Chrome Host Permission is not removed

#### Scenario: User closes or abandons the request

- **GIVEN** an Agent authorization confirmation is open
- **WHEN** the user closes the window or leaves it until timeout
- **THEN** the Agent command returns a denied result
- **AND** saved Panerelay grants and Chrome Host Permission remain unchanged

#### Scenario: Browser generation changes while approval is pending

- **GIVEN** one selected browser generation has a pending authorization request
- **WHEN** that generation disconnects or is replaced before settlement
- **THEN** the Bridge rejects the pending request
- **AND** it does not reroute approval or subsequent fetch through another browser

## MODIFIED Requirements

### Requirement: Fetch transport remains local and request-specific

The Bridge SHALL expose browser fetch and Agent-initiated fetch authorization only on its loopback listener and SHALL authenticate each call with the selected protected registration state or a short-lived fetch-session credential scoped to its endpoint. Native Messaging SHALL correlate each fetch or authorization request and result with opaque identifiers and bounded transfer framing. Fetch SHALL enforce an exact, wildcard, or all-domains Panerelay grant in the Extension before credential or network work, and neither flow SHALL attach or navigate a tab, focus a browser, or acquire a browser-control lease.

#### Scenario: Unauthenticated local caller reaches the Bridge

- **GIVEN** a process can connect to the Bridge loopback port but lacks the required registration or fetch-session bearer token
- **WHEN** it calls a fetch or authorization endpoint
- **THEN** the Bridge rejects the request without forwarding it to the Extension

#### Scenario: Fetch runs beside existing automation

- **GIVEN** another Panerelay automation participant controls an authorized tab
- **WHEN** a caller performs an authorized browser fetch or requests fetch authorization
- **THEN** the flow does not change the active participant, target attachment, tab authorization, or control lease
