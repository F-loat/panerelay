## ADDED Requirements

### Requirement: Bilingual connection-approach comparison page

The website SHALL provide crawlable English and Simplified Chinese comparison pages for visitors evaluating Panerelay, managed or isolated automation browsers, raw CDP attachment, and the Playwright Chrome Extension. Each page SHALL compare existing-login reuse, user-facing scope selection, connection approval, active-control visibility, browser-process ownership, and best-fit use cases using neutral language and direct evidence links. It SHALL present Panerelay as one option rather than a universal replacement and SHALL preserve the project's current-tab/all-supported-tabs authorization and separate active-control model.

#### Scenario: Visitor compares existing-browser options

- **GIVEN** a visitor wants an Agent to use an existing logged-in browser
- **WHEN** the visitor opens either localized comparison page
- **THEN** the visitor can understand the documented trade-offs, follow the cited upstream sources, and choose an approach without relying on unsupported superiority claims

#### Scenario: Visitor reviews Playwright Extension differences

- **GIVEN** a visitor is comparing Panerelay with the Playwright Chrome Extension
- **WHEN** the visitor reads the authorization and connection rows
- **THEN** the page distinguishes Panerelay's current-tab or all-supported-tabs scope choice and visible release from Playwright's documented selected-tab connection and per-connection approval or token option

### Requirement: Search-oriented static discovery

The comparison pages SHALL provide locale-specific titles, descriptions, canonical URLs, alternate-language links, social metadata, structured data, semantic headings, and internal links to installation, source, compatibility evidence, and the other locale. The sitemap and landing page SHALL expose the comparison entry points. All assets SHALL resolve under the GitHub Pages project path, and complete comparison content SHALL remain available without JavaScript.

#### Scenario: Search crawler discovers the comparison

- **GIVEN** a crawler loads the sitemap or follows an internal website link
- **WHEN** it fetches either comparison URL without executing JavaScript
- **THEN** it receives the localized comparison, evidence links, canonical and alternate-language metadata, and working project-subpath assets

#### Scenario: Comparison page is shared

- **GIVEN** a visitor shares either localized comparison URL
- **WHEN** a social crawler reads its metadata
- **THEN** the preview uses a locale-appropriate title, description, canonical URL, and Panerelay social image

### Requirement: Comparison accessibility and privacy

The comparison pages SHALL remain keyboard navigable, responsive at 375 CSS pixels, readable as linear content when the comparison table overflows, and compatible with reduced-motion preferences. They SHALL not add analytics, advertising, authentication, cookies, a Panerelay backend, or third-party scripts.

#### Scenario: Narrow comparison remains usable

- **GIVEN** a visitor opens a comparison page at 375 CSS pixels
- **WHEN** the visitor reads every approach and follows a primary action
- **THEN** content remains readable and operable without document-level horizontal scrolling or information available only through pointer hover
