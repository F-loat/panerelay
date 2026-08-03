## Purpose

Define a public, trustworthy entry point that explains Panerelay, guides visitors to installation and source resources, and preserves the project's documented browser-control and compatibility boundaries.

## ADDED Requirements

### Requirement: Focused product narrative

The website SHALL explain Panerelay through two clearly named paths: **Agent side panel**, where a local Agent works beside the page, and **Automation tool integrations**, where agent-browser, Browser Use, or Playwright CLI operates an existing Chrome or Microsoft Edge session under a tab scope the user chooses. It SHALL lead with the flexible choice between the current tab for focused work and all supported web tabs for cross-page workflows, while keeping active control separate, visible, and releasable. It SHALL present all three integrations as peer automation-engine choices within Automation tool integrations rather than as separate product modes or a primary pair plus a subordinate compatibility note.

#### Scenario: Visitor understands the product from the landing page

- **GIVEN** a visitor opens the website without prior Panerelay knowledge
- **WHEN** the primary page content is rendered
- **THEN** the visitor can identify Agent side panel and Automation tool integrations, and can see agent-browser, Browser Use, and Playwright CLI as choices within the latter, without opening another resource

#### Scenario: Visitor compares automation engines

- **GIVEN** a visitor is reading the Automation tool integrations workflow
- **WHEN** the engine comparison is rendered
- **THEN** agent-browser, Browser Use, and Playwright CLI are identified as peer, explicitly selected integrations, and every choice retains the same explicit-authorization and visible-revocation boundary

#### Scenario: Visitor understands flexible authorization

- **GIVEN** a visitor is deciding how much browser access an Agent needs
- **WHEN** the primary positioning, authorization guidance, or trust content is rendered
- **THEN** the visitor can tell that Panerelay supports both current-tab authorization and all-supported-tabs authorization, and that either scope remains distinct from the temporary active-control lease

### Requirement: First-screen standard workflow walkthrough

The website SHALL demonstrate the representative zero-to-first-control automation-tool journey on the first screen through six separate, product-accurate interface states: installing the Extension, installing the repository-level `panerelay-browser` Skill, asking an Agent to use that Skill with a supported automation integration, choosing between current-tab and all-supported-tabs authorization in the Extension, observing and controlling an authorized tab, and releasing control while preserving the selected authorization scope. The focused example MAY select current-tab authorization, but SHALL present both scopes as available user choices rather than implying that one-tab authorization is the only supported model. The first screen SHALL lead with a primary Extension installation action and a separate copyable Skill-backed Agent-setup action; documentation SHALL remain available at lower visual emphasis. Its descriptive sentence SHALL place agent-browser, Browser Use, and Playwright CLI in one compact vertically advancing tool reel with a visually distinctive monospace treatment and a complete static accessible equivalent.

At wide desktop widths, the hero and its positioning strip SHALL fit within one dynamic viewport, with shorter desktop heights tightening internal spacing instead of clipping content. Intermediate and mobile layouts SHALL expand naturally when a side-by-side composition is no longer readable. Localized headline text SHALL remain inside the copy column without painting beneath the product stage. At a 375 CSS-pixel viewport, every first-screen copy, action, trust item, and walkthrough surface SHALL remain within the same balanced left and right inset and SHALL NOT increase the document's horizontal scroll width.

Each step SHALL be directly selectable and SHALL display one complete active interface rather than overlapping multiple terminal, browser, authorization, or result surfaces. A step change SHALL replace the active panel immediately without a translation, fade, overlap, or intermediate state. The walkthrough SHALL use current Extension and setup vocabulary and SHALL keep code as supporting evidence rather than the only product explanation. It SHALL NOT expose a target name to the Agent before authorization, imply that `@panerelay/setup` installs an upstream automation tool, treat observation as active control, render page content in Panerelay's sanitized activity UI, or replace the Extension's authorization and release controls with page-owned overlays.

JavaScript enhancement SHALL coordinate one restrained pass through the six states using a labeled GSAP core timeline with keyboard-operable step selection, pause/resume, and restart controls. It SHALL pause on hover or keyboard focus, while outside the viewport, and while the document is hidden; manual step selection SHALL stop automatic advancement until the visitor explicitly resumes or restarts it. Reduced-motion visitors, narrow mobile visitors, and no-JavaScript visitors SHALL receive a coherent static and operable state without automatic movement, missing information, or dependence on GSAP. The walkthrough SHALL NOT use ScrollTrigger, optional GSAP plugins, fabricated performance claims, infinite looping, or copy that implies setup or focus grants authorization.

#### Scenario: New visitor understands the complete first-use journey

- **GIVEN** a visitor opens the landing page with ordinary motion enabled
- **WHEN** the first-screen walkthrough runs
- **THEN** the six install-first states appear in order as separate readable interfaces without moving the surrounding page layout, and the sequence stops after release rather than looping indefinitely

#### Scenario: Wide first screen fits without collisions

- **GIVEN** the landing page is rendered at a wide desktop viewport
- **WHEN** the localized hero and positioning strip are visible
- **THEN** they occupy one dynamic viewport and the headline, actions, and walkthrough remain within their own columns without clipping or overlap

#### Scenario: Hero presents three peer tools

- **GIVEN** the first screen is rendered with ordinary motion enabled
- **WHEN** the descriptive tool reel advances vertically
- **THEN** agent-browser, Browser Use, and Playwright CLI each receive the same visual treatment without changing the surrounding sentence geometry

#### Scenario: Narrow first screen keeps balanced insets

- **GIVEN** the landing page is rendered at a 375 CSS-pixel-wide viewport
- **WHEN** the visitor views the complete first screen in either supported language
- **THEN** the hero copy, actions, trust row, and walkthrough remain inside the viewport with a visible right inset matching the intended mobile content gutter and no horizontal page scrolling

#### Scenario: Unauthorized targets remain undisclosed

- **GIVEN** the walkthrough has not reached explicit current-tab or all-tabs authorization
- **WHEN** the Agent integration and doctor states are shown
- **THEN** no tab title or target is presented as discoverable to the Agent, and the setup state does not claim that focus or installation granted access

#### Scenario: Observation and control remain distinct

- **GIVEN** a tab has been explicitly authorized
- **WHEN** the Agent first lists or observes the eligible tab and then performs a mutating browser action
- **THEN** the controlled favicon and active-control state appear only after the mutating action while the result remains on the Agent surface and Panerelay shows only sanitized activity metadata

#### Scenario: Release preserves authorization

- **GIVEN** the selected Agent is actively controlling an authorized current tab
- **WHEN** the walkthrough's user activates the Extension-derived Release action
- **THEN** the controlled favicon and action badge clear, External Control becomes released, and the current-tab authorization remains visibly selected

#### Scenario: Authorization scope remains a user choice

- **GIVEN** the walkthrough reaches the Extension authorization state
- **WHEN** the Browser Access card is rendered
- **THEN** current-tab and all-tabs controls are both visible as deliberate scope choices, current-tab may be selected for the example, and neither choice is described as active control by itself

#### Scenario: Visitor controls playback

- **GIVEN** the walkthrough is running or complete
- **WHEN** the visitor selects a step or activates a playback control
- **THEN** the visitor can inspect that exact interface, pause or resume the current sequence, and restart it without flashing through intermediate steps or losing page content or keyboard focus

#### Scenario: Motion is unavailable or reduced

- **GIVEN** JavaScript is unavailable, the visitor requests reduced motion, or the site is viewed at a narrow mobile width
- **WHEN** the hero renders
- **THEN** the walkthrough remains understandable and directly operable without automatic advancement, large movement, or inaccessible hidden controls

### Requirement: Actionable installation journey

The website SHALL provide direct paths to the Chrome Web Store, the Panerelay GitHub repository, project documentation, and the upstream agent-browser, Browser Use, and Playwright CLI websites. Its initial installation journey SHALL contain two steps: install the Extension and install the repository-level `panerelay-browser` Skill with `npx skills add F-loat/panerelay --skill panerelay-browser`. The website SHALL state that the unified Skill contains agent-browser, Browser Use, and Playwright CLI workflows, while `@panerelay/setup` remains an advanced command for selected upstream program probes and Panerelay-owned Provider, adapter, and default management. The website SHALL NOT publish or reference a separate Agent setup document. The Skill command SHALL remain readable without JavaScript, and supported browsers SHALL offer a copy interaction with an accessible success indication.

The repository-level `panerelay-browser` Skill SHALL state that Panerelay setup does not install upstream automation tools. It SHALL provide deterministic steps for selected-engine environment inspection, official-source installation or update only when needed, the selected Panerelay integration, targeted doctor diagnostics, authorization-aware success verification, combined setup, supported-version boundaries, and platform-appropriate command execution without modifying unrelated Agent or Skill configuration.

#### Scenario: Visitor installs from the primary call to action

- **GIVEN** the landing page has loaded
- **WHEN** the visitor follows the primary installation path
- **THEN** the website exposes the Extension installation link and the repository Skill installation command before any workflow-specific Agent handoff

#### Scenario: Visitor copies the Skill installation command

- **GIVEN** clipboard APIs are available and JavaScript enhancement has loaded
- **WHEN** the visitor activates the Skill command copy control
- **THEN** the exact `npx skills add F-loat/panerelay --skill panerelay-browser` command is written to the clipboard and the control communicates completion without removing the visible command

#### Scenario: Visitor delegates workflow setup to an Agent

- **GIVEN** the visitor has installed Panerelay and wants agent-browser, Browser Use, Playwright CLI, or a supported combination
- **WHEN** the visitor selects and copies the corresponding Agent handoff
- **THEN** the copied instruction identifies the selected scenario, asks the Agent to use the installed `panerelay-browser` Skill, and relies on that Skill for the detailed safety and acceptance sequence while the subordinate manual command reflects the same selected integration flags

#### Scenario: Selected manual integration command stays synchronized

- **GIVEN** the visitor is viewing the Agent-guided tool chooser with JavaScript enhancement available
- **WHEN** the visitor selects agent-browser, Browser Use, or both
- **THEN** the visible secondary command and its copy action use the matching `@panerelay/setup` integration flags without changing the initial repository Skill installation command or treating Playwright CLI as a subordinate compatibility path

#### Scenario: Agent follows the installed Skill

- **GIVEN** an Agent receives one of the website or README handoffs
- **WHEN** it invokes the installed `panerelay-browser` Skill for the selected scenario
- **THEN** it can distinguish upstream-tool installation from Panerelay integration, run the exact integration and doctor steps, and report either verified authorized access or a concrete user action still required

#### Scenario: Visitor continues to upstream agent-browser documentation

- **GIVEN** the visitor is reading the agent-browser workflow
- **WHEN** the visitor follows its quickstart link
- **THEN** the website opens `https://agent-browser.dev/` as the upstream resource

#### Scenario: Visitor continues to upstream Browser Use documentation

- **GIVEN** the visitor is reading the Browser Use workflow
- **WHEN** the visitor follows its upstream documentation link
- **THEN** the website opens the official Browser Use documentation as the upstream resource

#### Scenario: Visitor continues to upstream Playwright CLI documentation

- **GIVEN** a visitor is reading the Playwright CLI workflow
- **WHEN** the visitor follows its connection resource
- **THEN** the website opens the repository's Playwright CLI integration documentation and compatibility evidence

#### Scenario: Page is usable without JavaScript

- **GIVEN** JavaScript is disabled or fails to load
- **WHEN** the visitor opens the website
- **THEN** the product narrative, all three engine descriptions, source links, Extension link, documentation links, repository Skill installation command, and all Agent handoff prompts remain available

### Requirement: Accessible automation-engine comparison

The website SHALL expose the agent-browser, Browser Use, and Playwright CLI comparison as a compact, content-sized, keyboard-operable tab interface within the workflow introduction when JavaScript enhancement is available and as three readable sections without JavaScript. It SHALL NOT use full-width tool buttons, redundant status sublabels, or a separate Playwright compatibility strip. The enhanced comparison MAY rotate automatically at a restrained interval, but SHALL stop automatic rotation after manual selection, pause while hovered or keyboard-focused, and disable automatic rotation when reduced motion is requested. Selecting an engine SHALL update the associated description, demonstration, and upstream and compatibility links without changing the global navigation, the repository Skill installation command, or the separate Agent handoff choices.

#### Scenario: Visitor selects Browser Use

- **GIVEN** the agent-browser comparison panel is active
- **WHEN** the visitor activates the Browser Use tab by pointer or keyboard
- **THEN** the Browser Use explanation and links become visible and automatic rotation stops

#### Scenario: Visitor selects Playwright CLI

- **GIVEN** either of the other automation-engine panels is active
- **WHEN** the visitor activates the Playwright CLI tab by pointer or keyboard
- **THEN** the Playwright CLI explanation, command demonstration, connection notes, and compatibility evidence become visible in the same panel structure and automatic rotation stops

#### Scenario: Automatic rotation remains non-disruptive

- **GIVEN** the visitor has not interacted with the comparison and does not request reduced motion
- **WHEN** the automatic interval elapses while the comparison has neither hover nor focus
- **THEN** the active engine advances through all three integrations while the tab selection and panel relationship remain available to assistive technology

#### Scenario: Reduced motion keeps a stable engine

- **GIVEN** the visitor requests reduced motion
- **WHEN** the enhanced engine comparison loads
- **THEN** no automatic engine or hero-tool rotation starts and all three engine choices remain manually operable while all three tool names remain readable

### Requirement: Honest safety and compatibility claims

The website SHALL state that site permission, tab authorization, and active control are separate; that the user may authorize the current tab or all supported web tabs; that access is visible and revocable; that releasing active control does not silently clear or widen the selected authorization scope; and that Panerelay does not own browser-process features. It SHALL identify agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17 as pinned evidence baselines, distinguish an accepted minimum from an exact verified baseline, and SHALL NOT describe Edge capability groups as `Verified` while the checked-in compatibility record classifies them as `Forwarded`. Browser Use claims SHALL cover its Browser Harness-backed CLI and CLI MCP surfaces in the unified Skill and SHALL NOT imply transparent interception of arbitrary Python SDK construction.

#### Scenario: Visitor reviews the trust boundary

- **GIVEN** a visitor is evaluating whether to grant browser access
- **WHEN** the visitor reads the website's safety content
- **THEN** the website describes the current-tab/all-supported-tabs scope choice, visible control, separate authorization and release behavior, local credential retention, and browser-process ownership limitations

#### Scenario: Compatibility claim follows project evidence

- **GIVEN** the website presents browser, agent-browser, or Browser Use compatibility
- **WHEN** the published page is compared with the checked-in compatibility records
- **THEN** all three integration baselines and their documented boundaries match the records and Edge is not promoted beyond its recorded `Forwarded` classification

### Requirement: Coherent repository onboarding

The root English and Simplified Chinese READMEs SHALL lead with Agent side panel, Automation tool integrations, and the user's choice between current-tab and all-supported-tabs authorization; present Extension installation plus the repository Skill as the complete normal onboarding path; and end the quickstart with a concise instruction for asking the Agent to use the Skill. They SHALL group optional setup flags, manual verification, Skill lifecycle commands, and Panerelay installation management into one default-collapsed advanced section after the architecture overview. They SHALL omit redundant supported-workflow and documentation sections while preserving top navigation and targeted inline links. Integration READMEs SHALL lead with the supported user outcome, flexible authorization scopes, prerequisites, Agent-guided setup, success criteria, upstream documentation, and compatibility record before internal adapter terminology, while technical CLI reference remains discoverable. Repository guidance SHALL use consistent labels for the two product paths, peer automation integrations, current-tab/all-supported-tabs authorization, accepted minimums, and exact verified baselines.

#### Scenario: New user chooses a setup path

- **GIVEN** a user opens either root README without prior Panerelay knowledge
- **WHEN** the user reaches the quickstart
- **THEN** the user sees the Extension-plus-Skill installation path and can ask an Agent to use the Skill with agent-browser, Browser Use, or Playwright CLI

#### Scenario: Browser Use user finds the supported boundary

- **GIVEN** a user opens the Browser Use integration README
- **WHEN** the user reviews prerequisites and compatibility
- **THEN** the document links to upstream Browser Use documentation, identifies supported Browser Harness-backed CLI and CLI MCP surfaces in the unified Skill, and states that arbitrary Python SDK construction is outside the transparent integration

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

#### Scenario: Agent setup controls stay aligned

- **GIVEN** a visitor reaches the Agent-guided setup step
- **WHEN** the prompt and Bridge diagram are rendered
- **THEN** the compact prompt-copy action remains inside the prompt card and the complete Browser–Bridge–Agent node group is horizontally centered in its visual panel

#### Scenario: Workflow cards share one content track

- **GIVEN** the automation-integration and Agent-side-panel workflow cards are rendered side by side on a wide viewport
- **WHEN** the visitor compares their content and visual columns
- **THEN** both cards use the same left-column width and their vertical division remains aligned

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
