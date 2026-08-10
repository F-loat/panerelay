## MODIFIED Requirements

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
