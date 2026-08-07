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

Panerelay SHALL accept absolute HTTP or HTTPS URLs, `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, and `OPTIONS`, repeated query values, a bounded textual or Base64 request body, a bounded timeout, cookie inclusion, and caller-provided request headers. Header names SHALL be compared case-insensitively, and explicit `Origin` and `Referer` headers SHALL be preserved as caller intent, including an explicit empty value that removes the corresponding generated source header.

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
- **AND** the error identifies the invalid field without including cookies or bearer credentials

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

### Requirement: Fetch transport remains local and request-specific

The Bridge SHALL expose browser fetch only on its loopback listener and SHALL authenticate each call with the selected protected registration state. Native Messaging SHALL correlate one request and result with opaque identifiers and bounded transfer framing. The first version SHALL NOT add a Panerelay-owned domain ACL, grant Chrome Host Permission, attach or navigate a tab, focus a browser, or acquire a browser-control lease.

#### Scenario: Unauthenticated local caller reaches the Bridge

- **GIVEN** a process can connect to the Bridge loopback port but lacks the registration bearer token
- **WHEN** it calls the fetch endpoint
- **THEN** the Bridge rejects the request without forwarding it to the Extension

#### Scenario: Fetch runs beside existing automation

- **GIVEN** another Panerelay automation participant controls an authorized tab
- **WHEN** a caller performs a browser fetch
- **THEN** the fetch does not change the active participant, target attachment, tab authorization, or control lease
