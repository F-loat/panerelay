## ADDED Requirements

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
