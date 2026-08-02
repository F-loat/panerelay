## Why

Panerelay's website and README explain individual integration paths, but they do not yet express the product in the simplest user terms: a local Agent can work beside the current page, while existing automation tools can operate explicitly authorized tabs in the user's browser. A focused, responsive product journey will lead with those two paths, keep agent-browser and Browser Use as peer automation choices, and let an Agent handle workflow-specific setup from a concise handoff backed by one authoritative repository guide.

## What Changes

- Add a dedicated Panerelay marketing website with a developer-focused dark visual system, concise product narrative, responsive navigation, and accessible interactions.
- Lead with two clear product paths: **Agent side panel** for local Agents beside the page and **Automation tool integrations** for agent-browser or Browser Use.
- Replace the static first-screen illustration with an install-first walkthrough made from product-accurate interface states: Extension installation, engine-neutral local integration, Agent-guided automation-tool integration, explicit tab authorization, visible Agent work, and user-controlled release that preserves the selected authorization scope. Keep the wide desktop hero and positioning strip within one dynamic viewport without letting localized copy collide with the product stage.
- Lead the first screen with a human installation action and a separate website-guide-backed “set up with your Agent” action; keep documentation as a lower-emphasis path and keep automation-engine choices local to the workflow.
- Add an accessible, progressively enhanced automation-engine comparison in the automation-tool workflow, with restrained automatic rotation only while the visitor has not interacted with it.
- Keep the initial human installation path focused on the Chrome Web Store and the engine-neutral `npx --yes @panerelay/setup` command; briefly document the optional `--agent-browser` and `--browser-use` flags, and within the Agent-guided tool chooser let the secondary manual integration command mirror the selected agent-browser, Browser Use, or combined scenario.
- Publish the checked-in Agent setup guide at the project website's stable `/agent-setup.md` path with explicit agent-browser, Browser Use, and combined paths, then keep each copyable handoff to the guide URL, selected scenario, and instruction to execute it.
- Include direct calls to action for GitHub, documentation, upstream agent-browser and Browser Use resources, compatibility records, and the MIT license.
- Provide complete English and Simplified Chinese presentations with an accessible language switcher, browser-language selection for first visits, and a locally remembered preference.
- Use the public GSAP core package only for the first-screen walkthrough timeline, with static HTML, reduced-motion, visibility-pause, and manual playback fallbacks; do not add ScrollTrigger or animation plugins.
- Add an automated GitHub Pages build and deployment workflow for the repository's default branch.
- Align the root and integration README journey around Agent side panel, Automation tool integrations, one engine-neutral product installation command, and Agent-guided workflow configuration, while keeping optional integration flags discoverable and dense compatibility evidence in `docs/compatibility/`.
- Publish only claims supported by the current product and compatibility records. The pinned evidence baselines remain agent-browser 0.33.0 and Browser Use 0.13.7 with Browser Harness 0.1.8; Chrome capability groups may be described according to their recorded classifications, while Edge remains `Forwarded` pending representative acceptance.
- Keep browser ownership limitations explicit: Panerelay operates only authorized tabs and does not own browser-process features such as isolated profiles, launch-time proxies, or closing the user's browser.
- Non-goals: building a full documentation portal, introducing a hosted Panerelay service, adding analytics or cookies, changing Extension/Bridge/protocol behavior, transparently intercepting arbitrary Browser Use Python SDK construction, or claiming broader browser compatibility than the checked-in evidence supports.

## Capabilities

### New Capabilities

- `project-website`: Covers the public website and repository entry documentation, installation journey, responsive and accessible engine comparison, honest compatibility messaging, and GitHub Pages delivery.

### Modified Capabilities

None.

## Impact

- Adds a new workspace application under `apps/website` and its static production build.
- Adds a GitHub Actions workflow and GitHub Pages repository configuration for deployment.
- Updates workspace metadata and lockfile entries required by the website build.
- Stores only the visitor's language preference in local browser storage; no cookie, account, analytics identifier, or backend service is introduced.
- Updates the root, setup, agent-browser, and Browser Use README entry points without changing runtime APIs or package behavior.
- Links to the existing Chrome Web Store, GitHub, upstream tool documentation, RFC, and compatibility resources.
- Does not alter browser attachment, CDP behavior, control ownership, permissions, releases, package publishing, or any current compatibility classification.
