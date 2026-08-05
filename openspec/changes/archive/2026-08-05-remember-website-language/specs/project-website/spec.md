## MODIFIED Requirements

### Requirement: English and Simplified Chinese presentation

The website SHALL provide complete, statically rendered English and Simplified Chinese presentations through keyboard-operable language links on the homepage and comparison page. When no supported Panerelay locale preference is stored, the requested static document SHALL remain the active presentation. A visitor's explicit language selection SHALL be stored only in local browser storage and SHALL take precedence on later JavaScript-enabled visits. When the stored locale differs from the served document language, the website SHALL replace the current history entry with the equivalent localized page while preserving the current query string and fragment. Missing, inaccessible, or invalid local storage values SHALL leave the requested document unchanged. Switching languages SHALL present locale-appropriate visible content, accessible control labels, document language, title, and description without a backend service. Simplified Chinese copy SHALL use idiomatic product language rather than word-for-word translation, and its typography SHALL use a locale-specific font stack, scale, spacing, and line breaking. Editorial Chinese accents MAY load an explicitly allowlisted OFL-1.1 webfont stylesheet, but SHALL retain usable system fallbacks. The requested static document SHALL remain complete and usable without JavaScript.

#### Scenario: First visit keeps the requested static locale

- **GIVEN** no supported Panerelay language preference is stored
- **WHEN** a visitor opens an English or Simplified Chinese website URL
- **THEN** the requested static document remains active and identifies its served language

#### Scenario: Explicit selection is remembered

- **GIVEN** the website is presented in either supported language
- **WHEN** the visitor activates a language link and later opens a website page in the other locale with JavaScript enabled
- **THEN** the equivalent page in the selected language replaces the current history entry with its document language, title, description, query string, and fragment intact

#### Scenario: Preference applies to the comparison page

- **GIVEN** the visitor has explicitly selected English or Simplified Chinese on the website
- **WHEN** the visitor later opens the homepage or comparison page in the other locale with JavaScript enabled
- **THEN** the website navigates to the equivalent localized homepage or comparison page rather than to a different content route

#### Scenario: Unavailable preference storage fails open to static content

- **GIVEN** local browser storage is unavailable or contains a value other than a supported website locale
- **WHEN** a visitor opens a website page
- **THEN** the requested static document remains usable and no automatic language navigation occurs

#### Scenario: Language switch remains accessible

- **GIVEN** a visitor uses a keyboard or assistive technology
- **WHEN** the visitor reaches and activates a language link
- **THEN** the link communicates its purpose and current language and all localized controls retain meaningful accessible names

#### Scenario: Chinese presentation keeps intentional headline rhythm

- **GIVEN** the Simplified Chinese presentation is active at a 1024 CSS-pixel-wide viewport
- **WHEN** the hero, workflow, setup, trust, and final headlines are rendered
- **THEN** their locale- and container-specific scales preserve each intended phrase without an orphaned character, horizontal overflow, or reliance on a commercial font

#### Scenario: Open webfont failure preserves the page

- **GIVEN** the allowlisted Chinese webfont stylesheet or font files are unavailable
- **WHEN** the website renders
- **THEN** system font fallbacks preserve readable content, layout, language switching, and every functional interaction
