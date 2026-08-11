## MODIFIED Requirements

### Requirement: Actionable installation journey

The website SHALL provide direct paths to the Chrome Web Store, the Panerelay GitHub repository, project documentation, and the upstream agent-browser, Browser Use, and Playwright CLI websites. Its initial installation journey SHALL install the Extension, run base Setup with `npx --yes @panerelay/setup`, and install the repository-level `panerelay` Skill with `npx skills add https://github.com/F-loat/panerelay --skill panerelay`. The website SHALL state that base Setup installs the Native Host and global CLI and performs its supported interactive integration flow, while the unified Skill guides browser-authenticated Fetch, Agent routing, agent-browser, Browser Use, and Playwright CLI workflows. The Setup section SHALL NOT repeat that interactive integration flow with a second automation-engine chooser, per-engine Agent setup prompts, or subordinate per-engine Setup commands. The website SHALL NOT publish or reference a separate Agent setup document. The Setup and Skill commands SHALL remain readable without JavaScript, and supported browsers SHALL offer copy interactions with accessible success indications.

The Setup section SHALL instead provide a concise Agent-facing Fetch usage guide. It SHALL tell the visitor to provide a known absolute HTTP(S) URL, ask the Agent to use the installed `panerelay` Skill and Panerelay Fetch with browser login state, and approve the exact domain in the Extension if requested. The localized example prompt SHALL remain readable without JavaScript and SHALL offer an accessible copy interaction when JavaScript and clipboard APIs are available. The complete raw CLI authorization and absolute-URL Fetch path SHALL remain available in the later Fetch workflow.

The repository-level `panerelay` Skill SHALL state that Panerelay setup does not install upstream automation tools. It SHALL provide deterministic steps for browser-authenticated Fetch selection, selected-engine environment inspection, official-source installation or update only when needed, the selected Panerelay integration, targeted doctor diagnostics, authorization-aware success verification, combined setup, supported-version boundaries, and platform-appropriate command execution without modifying unrelated Agent or Skill configuration.

#### Scenario: Visitor installs from the primary call to action

- **GIVEN** the landing page has loaded
- **WHEN** the visitor follows the primary installation path
- **THEN** the website exposes the Extension installation link, base Setup command, and repository Skill installation command before workflow usage guidance

#### Scenario: Visitor copies the Skill installation command

- **GIVEN** clipboard APIs are available and JavaScript enhancement has loaded
- **WHEN** the visitor activates the Skill command copy control
- **THEN** the exact `npx skills add https://github.com/F-loat/panerelay --skill panerelay` command is written to the clipboard and the control communicates completion without removing the visible command

#### Scenario: Setup integration choices are not repeated

- **GIVEN** the visitor has reached the Setup section after seeing the interactive base Setup command
- **WHEN** the adjacent usage guidance is rendered
- **THEN** it does not present a second agent-browser, Browser Use, Playwright CLI, or combined setup chooser or any matching per-engine Setup command

#### Scenario: Visitor delegates a browser-authenticated Fetch

- **GIVEN** the visitor knows an absolute HTTP(S) endpoint that needs browser login state
- **WHEN** the visitor reads or copies the localized Fetch example prompt
- **THEN** the instruction asks the Agent to use the installed `panerelay` Skill and Panerelay Fetch for that URL and tells the visitor that a new domain requires direct Extension approval

#### Scenario: Agent follows the installed Skill

- **GIVEN** an Agent receives the website's Fetch instruction or a Connect request
- **WHEN** it invokes the installed `panerelay` Skill for the selected workflow
- **THEN** it can distinguish Fetch from browser automation and report either a completed request, verified authorized access, or a concrete user approval still required

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
- **THEN** the product narrative, all three engine descriptions, source links, Extension link, documentation links, Setup and Skill installation commands, and Fetch usage instruction remain available

### Requirement: Homepage provides a contained and actionable Fetch-first introduction

The English and Simplified Chinese homepages SHALL use a concise hero headline that remains inside its copy column without painting beneath the walkthrough at wide desktop widths or increasing document width at 375 CSS pixels. The hero title, supporting sentence, actions, and property list SHALL avoid repeating the same Fetch and Connect explanation in equivalent wording. After the hero and concise value explanation, the page SHALL present Setup before the Fetch and Connect workflows, followed by the trust boundary.

The Fetch and Connect section SHALL present the Fetch workflow before the Connect engine comparison. Its Fetch example SHALL show a complete executable path in this order: run base Setup, authorize an exact domain, call an absolute HTTP(S) URL with the bare `panerelay` command, and optionally install and invoke a site adapter. It SHALL distinguish the CLI from the Agent Skill and SHALL NOT present a relative URL as a standalone raw Fetch target. The Setup section SHALL expose both Setup and Skill installation commands before a concise Agent-facing Fetch instruction, while the separate Connect comparison SHALL retain upstream engine guidance and compatibility evidence.

#### Scenario: Visitor learns the shortest Fetch path

- **GIVEN** a visitor knows an authenticated HTTP(S) endpoint
- **WHEN** the visitor reads the homepage Setup and Fetch workflow sections
- **THEN** the visitor can ask an Agent to use Panerelay Fetch with browser login state or run Setup, approve the exact domain, and run one absolute-URL Fetch command without consulting another page
- **AND** the raw CLI workflow shows how a built-in site adapter is installed before its bare `panerelay` command is used

#### Scenario: Visitor distinguishes the CLI and Skill

- **GIVEN** a visitor reaches the hero or Setup section
- **WHEN** installation guidance is rendered
- **THEN** the page identifies base Setup as the source of the persistent `panerelay` command and supported integration flow
- **AND** it identifies the repository Skill as Agent workflow guidance rather than the CLI executable

#### Scenario: Localized hero stays in its layout track

- **GIVEN** either localized homepage is rendered at a wide desktop viewport or 375 CSS pixels
- **WHEN** the hero headline and supporting Fetch and Connect sentence are visible
- **THEN** the text remains inside the intended copy track without horizontal document overflow or collision with the walkthrough
