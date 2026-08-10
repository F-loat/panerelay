# browser-fetch-relay Specification

## Purpose

Define a bounded fetch-shaped request path that uses a selected live Panerelay browser session while preserving Bridge routing, credential confidentiality, and browser ownership boundaries.

## Requirements

### Requirement: Browser fetch uses one selected live registration

Panerelay SHALL route each fetch invocation through exactly one live browser registration selected by an explicit `--browser` value or the existing saved-default and unambiguous-selection rules. The request SHALL be bound to the selected registration identity and generation, SHALL fail if that generation changes, and SHALL NOT silently retry through another browser.

#### Scenario: Default browser is available

- **GIVEN** one live browser is selected by the existing routing rules
- **WHEN** the caller issues a browser fetch
- **THEN** the Bridge for that registration sends the request to its connected Extension
- **AND** no CDP participant or browser-control lease is created

#### Scenario: Selected browser changes during the request

- **GIVEN** the CLI selected one browser registration and generation
- **WHEN** that registration disconnects or is replaced before the request completes
- **THEN** the request fails with an unavailable-generation error
- **AND** Panerelay does not select another browser or perform the request outside the Extension

### Requirement: Browser fetch accepts bounded fetch-shaped input

Panerelay SHALL accept absolute HTTP or HTTPS URLs, `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, and `OPTIONS`, repeated query values, a textual or Base64 request body of at most 16 MiB decoded bytes, a bounded timeout, cookie inclusion, and caller-provided request headers. Header names SHALL be compared case-insensitively, and explicit `Origin` and `Referer` headers SHALL be preserved as caller intent, including an explicit empty value that removes the corresponding generated source header. A request carrying resolved Cookie bindings SHALL reject redirects.

#### Scenario: Caller customizes source headers

- **GIVEN** Chrome has Host Permission for the target URL
- **WHEN** the caller supplies explicit `Origin` and `Referer` header values
- **THEN** the Extension issues the request with those values
- **AND** generated source-header defaults do not overwrite them

#### Scenario: Caller omits source headers

- **GIVEN** Chrome has Host Permission for the target URL
- **WHEN** the caller does not supply `Origin` or `Referer`
- **THEN** the Extension uses the target origin as `Origin` and `<target-origin>/panerelay` as `Referer`

#### Scenario: Input exceeds a bound

- **GIVEN** a URL, header collection, body, timeout, or decoded payload exceeds its documented bound
- **WHEN** the request is validated
- **THEN** Panerelay rejects it before issuing a browser network request
- **AND** the error identifies the invalid field without including cookies or request bodies

### Requirement: Browser fetch can reuse browser cookies without exposing them

Browser fetch SHALL include cookies for the target URL by default and SHALL support explicitly disabling cookie inclusion. Cookie collection and injection SHALL occur inside the Extension, and response data, CLI output, adapter input, diagnostics, and default logs SHALL NOT contain the collected cookie header or Bridge registration bearer token.

#### Scenario: Authenticated request succeeds

- **GIVEN** the selected browser has cookies for the target URL and Chrome has granted Host Permission
- **WHEN** a caller performs a fetch without disabling cookies
- **THEN** the request includes the applicable browser cookies
- **AND** the result reports only the number of attached cookies, not their names or values

#### Scenario: Caller disables cookies

- **GIVEN** the selected browser has cookies for the target URL
- **WHEN** the caller disables cookie inclusion
- **THEN** the Extension sends no generated `Cookie` header
- **AND** the result reports zero attached cookies

### Requirement: Browser fetch can bind Cookie values without disclosing them

Browser fetch SHALL accept a bounded list of Cookie-value bindings that name a Cookie applicable to the target URL and inject its value inside the Extension into either an `application/x-www-form-urlencoded` field, a top-level JSON field, or a non-reserved request header. A binding SHALL support raw or URL-decoded values and required or optional absence. Binding declarations SHALL cross the Bridge, but resolved Cookie values SHALL NOT enter Native Messaging results, adapter input or output, CLI output, or default diagnostics. Cookie-bound requests SHALL reject redirects rather than risk forwarding the injected value to another URL, and the first version SHALL NOT bind credentials into URL query parameters.

#### Scenario: Adapter binds CSRF Cookie into a form body

- **GIVEN** the target URL has an applicable `bili_jct` Cookie and Chrome has granted Host Permission
- **WHEN** an adapter issues a POST request binding `bili_jct` to the `csrf` form field
- **THEN** the Extension replaces any caller-supplied `csrf` field with the Cookie value immediately before fetch
- **AND** the Bridge and adapter never receive that value

#### Scenario: Header-style CSRF token is URL-decoded

- **GIVEN** the target URL has an applicable percent-encoded CSRF Cookie
- **WHEN** a binding requests URL decoding into a non-reserved request header
- **THEN** the Extension sends the decoded value in that header
- **AND** it does not change the caller's body representation

#### Scenario: Required bound Cookie is absent

- **GIVEN** a binding marks one Cookie as required and no applicable Cookie with that name exists
- **WHEN** the Extension prepares the request
- **THEN** the request fails before header-rule installation or network activity
- **AND** the error identifies the missing Cookie name without exposing any other Cookie name or value

#### Scenario: Cookie header is disabled but one value is bound

- **GIVEN** a request disables generated Cookie-header inclusion and declares a Cookie binding
- **WHEN** the Extension prepares the request
- **THEN** it reads only as needed to resolve the declared binding and sends no generated `Cookie` header
- **AND** the result reports zero attached cookies

#### Scenario: Bound request redirects

- **GIVEN** a request contains a resolved Cookie-value binding
- **WHEN** the target responds with a redirect
- **THEN** browser fetch fails without following the redirect
- **AND** the bound value is not sent to the redirect destination

### Requirement: Browser fetch returns a structured bounded response

Panerelay SHALL return the HTTP status, status text, response headers, body, body type, final URL, redirect state, and attached-cookie count. The caller SHALL be able to request automatic, JSON, text, or Base64 body handling. Non-2xx HTTP responses SHALL remain successful transport results, while timeouts, invalid payloads, missing Chrome Host Permission, disconnection, and response-size violations SHALL fail explicitly.

#### Scenario: Server returns an HTTP error

- **GIVEN** the browser successfully reaches a server
- **WHEN** the server responds with HTTP 404 and a JSON body
- **THEN** Panerelay returns status 404 and the parsed JSON body
- **AND** it does not misclassify the HTTP status as a Bridge transport failure

#### Scenario: Chrome rejects access for an ungranted site

- **GIVEN** the Extension does not hold Host Permission for the target origin
- **WHEN** the caller issues a browser fetch
- **THEN** Panerelay attempts the operation without a separate permission query
- **AND** the first Chrome rejection stops the request
- **AND** the error identifies the origin and tells the user to grant Chrome site access

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

### Requirement: Fetch sessions constrain every request to declared origins

Every browser-fetch session SHALL carry a bounded normalized list of HTTP(S) exact or wildcard origin patterns chosen by its trusted caller. The Bridge and Extension SHALL independently reject an initial request outside those origins before Cookie or storage access, header-rule installation, or network activity. Raw CLI and MCP calls SHALL use only the request URL's exact origin; adapter calls SHALL use the installed manifest's protected origins.

#### Scenario: Adapter requests a declared origin

- **GIVEN** an installed adapter manifest declares an origin matching its API URL
- **WHEN** the adapter issues a request to that URL
- **THEN** both the Bridge and Extension accept the session-origin check
- **AND** the separate saved-domain and Chrome Host Permission checks still apply

#### Scenario: Adapter requests an undeclared origin

- **GIVEN** an adapter session does not include the target origin
- **WHEN** the adapter child requests that target
- **THEN** the Bridge rejects the request before Native Messaging
- **AND** no browser credential or target response reaches the adapter

### Requirement: Browser fetch rejects redirects before credential forwarding

Browser fetch SHALL use redirect-error behavior for every request and SHALL remove caller control over automatic redirect following. A redirect SHALL fail without a second network request, including when no binding is active. Compatibility documentation SHALL identify this as a browser Fetch API limitation: manual mode hides the redirect target, so Panerelay cannot authorize the next hop safely before sending it.

#### Scenario: Server redirects a request

- **GIVEN** an authorized origin returns an HTTP redirect
- **WHEN** browser fetch receives that response
- **THEN** the operation fails without following the Location target
- **AND** no Cookie, bound browser-state value, request body, or caller header is sent to a second URL

### Requirement: Browser fetch can use declared exact-origin browser-state bindings

An adapter manifest SHALL be able to declare bounded binding policies with stable IDs, fixed source metadata, fixed destinations, and allowed request origins. Cookie sources SHALL resolve against the request URL. A `localStorage` source SHALL name one exact HTTP(S) origin and key and MAY declare bounded JSON Pointer fallbacks. The Extension SHALL read localStorage only from an already-open tab at that exact origin, resolve and inject the value inside the Extension, and SHALL NOT return it across Native Messaging. Raw CLI and MCP sessions SHALL expose no binding policies.

#### Scenario: Adapter injects a localStorage token

- **GIVEN** an already-open exact-origin tab contains a declared localStorage JSON value and the request origin is allowed by the policy
- **WHEN** an adapter request selects that protected binding ID
- **THEN** the Extension resolves the first declared string value and injects it into the fixed destination
- **AND** the tab is not focused, navigated, authorized for control, or attached through CDP

#### Scenario: Matching origin has no open tab

- **GIVEN** no open tab has the binding policy's exact origin
- **WHEN** the Extension prepares the bound request
- **THEN** the request fails before network activity with an authentication-oriented error
- **AND** Panerelay does not open or navigate a tab to obtain storage

#### Scenario: Adapter selects an undeclared binding

- **GIVEN** a child adapter receives a fetch session with protected binding policies
- **WHEN** it supplies an unknown binding ID or uses a policy on an unapproved request origin
- **THEN** the Bridge rejects the request before Native Messaging
- **AND** the adapter cannot choose an arbitrary Cookie, storage key, source origin, header, or body field

### Requirement: Cookie write-back and partition boundaries are explicit

The Extension SHALL execute browser fetches with browser credential persistence enabled while continuing to replace or remove the outgoing Cookie header from its own unpartitioned Cookie selection. Applicable unpartitioned `Set-Cookie` responses MAY update the browser Cookie jar but SHALL never be exposed in the structured response. Partitioned Cookies SHALL remain excluded from explicit attachment because browser fetch has no user-authorized top-level-site partition context.

#### Scenario: Response refreshes an unpartitioned session Cookie

- **GIVEN** an authorized response sets an applicable unpartitioned Cookie
- **WHEN** a later browser fetch targets the Cookie's scope
- **THEN** the Extension may attach the refreshed Cookie
- **AND** neither response exposes the Set-Cookie header or Cookie value

#### Scenario: Only a partitioned Cookie exists

- **GIVEN** the browser stores a target Cookie only under a partition key
- **WHEN** browser fetch collects explicit outgoing Cookies
- **THEN** the partitioned Cookie is not attached or converted to an unpartitioned Cookie
- **AND** Panerelay does not invent a top-level-site context

### Requirement: Bound secrets are redacted without corrupting unrelated short data

The Extension SHALL require each resolved bound value and transformed value to meet a minimum safe redaction length before sending a request. Bound responses SHALL be limited to textual or JSON representations, and exact secret occurrences SHALL be replaced before headers or bodies cross Native Messaging. Binary bound responses and values too short for safe matching SHALL fail closed rather than applying blind byte replacement.

#### Scenario: Bound endpoint reflects a long token

- **GIVEN** a bound value meets the redaction minimum
- **WHEN** the response reflects it in a text or JSON body or response header
- **THEN** the Extension replaces the occurrence before returning the result
- **AND** the adapter cannot recover the original value

#### Scenario: Browser state contains a short value

- **GIVEN** a declared binding resolves to a value below the safe redaction minimum
- **WHEN** the Extension prepares the request
- **THEN** it fails before sending the request
- **AND** unrelated equal short strings in later responses are never blindly rewritten
