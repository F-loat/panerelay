## Why

Panerelay's website and README explain individual integration paths, but they do not yet express the product in the simplest user terms: an Agent can live inside the browser, or an Agent can use the browser from its existing environment. A focused, responsive product journey will lead with those two complementary outcomes, keep agent-browser and Browser Use as peer choices under the external-Agent path, and let an Agent handle workflow-specific setup from a natural-language handoff.

## What Changes

- Add a dedicated Panerelay marketing website with a developer-focused dark visual system, concise product narrative, responsive navigation, and accessible interactions.
- Lead with two complementary product directions: **Agent in Browser** for local Agents in the side panel and **Agent Use Browser** for external automation through agent-browser or Browser Use.
- Add an accessible, progressively enhanced automation-engine comparison in the external-Agent workflow, with restrained automatic rotation only while the visitor has not interacted with it.
- Keep the human installation path focused on the Chrome Web Store and the engine-neutral `npx --yes @panerelay/setup` command.
- Add copyable natural-language Agent handoffs for configuring agent-browser, Browser Use, or both, so workflow-specific commands are executed in context by the user's Agent rather than presented as parallel product installation commands.
- Include direct calls to action for GitHub, documentation, upstream agent-browser and Browser Use resources, compatibility records, and the MIT license.
- Provide complete English and Simplified Chinese presentations with an accessible language switcher, browser-language selection for first visits, and a locally remembered preference.
- Add an automated GitHub Pages build and deployment workflow for the repository's default branch.
- Align the root and integration README journey around Agent in Browser, Agent Use Browser, one engine-neutral product installation command, and Agent-first workflow configuration, while keeping CLI flags discoverable in technical reference and dense compatibility evidence in `docs/compatibility/`.
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
