## Purpose

Define a public, trustworthy entry point that explains Panerelay, guides visitors to installation and source resources, and preserves the project's documented browser-control and compatibility boundaries.

## ADDED Requirements

### Requirement: Focused product narrative

The website SHALL explain that Panerelay connects AI Agents to explicitly authorized tabs in an existing Chrome or Microsoft Edge session and SHALL distinguish that workflow from the browser side-panel Agent workflow.

#### Scenario: Visitor understands the product from the landing page

- **GIVEN** a visitor opens the website without prior Panerelay knowledge
- **WHEN** the primary page content is rendered
- **THEN** the visitor can identify both the existing-browser agent-browser workflow and the local-Agent side-panel workflow without opening another resource

### Requirement: Actionable installation journey

The website SHALL provide direct paths to the Chrome Web Store, the Panerelay GitHub repository, project documentation, the upstream agent-browser website, and a complete `npx --yes @panerelay/setup` command. The command SHALL remain readable without JavaScript, and supported browsers SHALL offer a copy interaction with an accessible success indication.

#### Scenario: Visitor installs from the primary call to action

- **GIVEN** the landing page has loaded
- **WHEN** the visitor follows the primary installation path
- **THEN** the website exposes both the Extension installation link and the local setup command in the required order

#### Scenario: Visitor copies the setup command

- **GIVEN** clipboard APIs are available and JavaScript enhancement has loaded
- **WHEN** the visitor activates the setup command copy control
- **THEN** the exact setup command is written to the clipboard and the control communicates completion without removing the visible command

#### Scenario: Visitor continues to upstream agent-browser documentation

- **GIVEN** the visitor is reading the agent-browser workflow
- **WHEN** the visitor follows its quickstart link
- **THEN** the website opens `https://agent-browser.dev/` as the upstream resource

#### Scenario: Page is usable without JavaScript

- **GIVEN** JavaScript is disabled or fails to load
- **WHEN** the visitor opens the website
- **THEN** the product narrative, source links, Extension link, documentation links, and setup command remain available

### Requirement: Honest safety and compatibility claims

The website SHALL state that site permission, tab authorization, and active control are separate; that access is visible and revocable; and that Panerelay does not own browser-process features. It SHALL identify agent-browser 0.33.0 as the pinned evidence baseline and SHALL NOT describe Edge capability groups as `Verified` while the checked-in compatibility record classifies them as `Forwarded`.

#### Scenario: Visitor reviews the trust boundary

- **GIVEN** a visitor is evaluating whether to grant browser access
- **WHEN** the visitor reads the website's safety content
- **THEN** the website describes explicit authorization, visible control, revocation, local credential retention, and browser-process ownership limitations

#### Scenario: Compatibility claim follows project evidence

- **GIVEN** the website presents browser or agent-browser compatibility
- **WHEN** the published page is compared with the checked-in compatibility records
- **THEN** agent-browser 0.33.0 is identified as the evidence baseline and Edge is not promoted beyond its recorded `Forwarded` classification

### Requirement: Responsive and accessible experience

The website SHALL provide semantic document structure, keyboard-operable navigation and controls, visible focus treatment, alternative text for meaningful images, a responsive layout for narrow and wide viewports, and reduced-motion behavior for visitors who request it.

#### Scenario: Keyboard-only visitor reaches primary actions

- **GIVEN** a visitor uses only a keyboard
- **WHEN** the visitor moves through the page controls
- **THEN** navigation, installation, copy, documentation, and GitHub actions are reachable in a logical order with a visible focus indicator

#### Scenario: Narrow viewport preserves content

- **GIVEN** the viewport is 375 CSS pixels wide
- **WHEN** the landing page is rendered and scrolled from top to bottom
- **THEN** primary content and controls remain readable and operable without horizontal page scrolling

#### Scenario: Reduced motion is requested

- **GIVEN** the visitor's browser reports `prefers-reduced-motion: reduce`
- **WHEN** the page renders and interactive states change
- **THEN** non-essential motion and smooth scrolling are disabled

### Requirement: English and Simplified Chinese presentation

The website SHALL provide complete English and Simplified Chinese presentations through a keyboard-operable language switcher. On the first JavaScript-enabled visit, it SHALL select Simplified Chinese when the browser's preferred language starts with `zh` and English otherwise. A visitor's explicit selection SHALL take precedence on later visits and SHALL be stored only in local browser storage. Switching languages SHALL update translatable visible content, accessible control labels, the document language, title, and description without requiring navigation or a backend service. Simplified Chinese copy SHALL use idiomatic product language rather than word-for-word translation, and its typography SHALL use a locale-specific font stack, scale, spacing, and line breaking. Editorial Chinese accents MAY load an explicitly allowlisted OFL-1.1 webfont stylesheet, but SHALL retain usable system fallbacks. English content SHALL remain the complete no-JavaScript baseline.

#### Scenario: First visit follows browser language

- **GIVEN** no Panerelay language preference is stored
- **WHEN** a visitor whose preferred browser language starts with `zh` opens the website with JavaScript enabled
- **THEN** the website presents Simplified Chinese and identifies the document language as `zh-CN`

#### Scenario: Explicit selection is remembered

- **GIVEN** the website is presented in either supported language
- **WHEN** the visitor selects the other language and later reloads the website
- **THEN** the selected presentation, document language, title, and description remain active

#### Scenario: Language switch remains accessible

- **GIVEN** a visitor uses a keyboard or assistive technology
- **WHEN** the visitor reaches and activates the language switcher
- **THEN** the control communicates its purpose and current language and all translated controls retain meaningful accessible names

#### Scenario: Chinese presentation keeps intentional headline rhythm

- **GIVEN** the Simplified Chinese presentation is active at a 1024 CSS-pixel-wide viewport
- **WHEN** the hero, workflow, setup, trust, and final headlines are rendered
- **THEN** their locale- and container-specific scales preserve each intended phrase without an orphaned character, horizontal overflow, or reliance on a commercial font

#### Scenario: Open webfont failure preserves the page

- **GIVEN** the allowlisted Chinese webfont stylesheet or font files are unavailable
- **WHEN** the website renders
- **THEN** system font fallbacks preserve readable content, layout, language switching, and every functional interaction

### Requirement: GitHub Pages delivery

The repository SHALL build the website as static assets and SHALL deploy those assets through GitHub Pages from the default branch. Push and manual deployment runs SHALL accept only `refs/heads/main`, with other manually selected refs rejected before checkout. The output SHALL work from the repository project subpath and SHALL not require a server-side runtime.

#### Scenario: Default-branch deployment succeeds

- **GIVEN** website changes are present on the repository default branch
- **WHEN** the GitHub Pages workflow runs
- **THEN** it builds and publishes a static artifact using least-privilege Pages permissions

#### Scenario: Project-path assets resolve

- **GIVEN** the production site is hosted below the repository's GitHub Pages project path
- **WHEN** a visitor loads the page directly
- **THEN** styles, scripts, icons, and internal fragment links resolve without root-domain assumptions

### Requirement: Privacy-preserving static site

The website SHALL operate without analytics, advertising scripts, cookies, authentication, or transmission of page content to a Panerelay service.

#### Scenario: Visitor loads the production page

- **GIVEN** a visitor opens the deployed website
- **WHEN** all first-party page functionality is exercised
- **THEN** no consent banner, account, analytics identifier, or Panerelay-hosted application backend is required
