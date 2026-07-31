## Why

Panerelay's README explains the product, but the project has no focused public entry point that can communicate its value, establish trust, and move new users from discovery to installation. A fast, responsive project website will give Panerelay a stable home for its core story, setup path, safety model, and compatibility boundaries.

## What Changes

- Add a dedicated Panerelay marketing website with a developer-focused dark visual system, concise product narrative, responsive navigation, and accessible interactions.
- Present the two primary workflows: using agent-browser in an existing authorized Chrome or Edge session, and working with local Agents from the browser side panel.
- Include direct calls to action for the Chrome Web Store, the `@panerelay/setup` command, GitHub, documentation, compatibility records, and the MIT license.
- Add a copyable setup command and lightweight progressive enhancement without making the page depend on client-side rendering.
- Provide complete English and Simplified Chinese presentations with an accessible language switcher, browser-language selection for first visits, and a locally remembered preference.
- Add an automated GitHub Pages build and deployment workflow for the repository's default branch.
- Publish only claims supported by the current product and compatibility records. The pinned evidence baseline remains agent-browser 0.33.0; Chrome capability groups may be described according to their recorded classifications, while Edge remains `Forwarded` pending representative acceptance.
- Keep browser ownership limitations explicit: Panerelay operates only authorized tabs and does not own browser-process features such as isolated profiles, launch-time proxies, or closing the user's browser.
- Non-goals: replacing the full technical documentation, introducing a hosted Panerelay service, adding analytics or cookies, changing Extension/Bridge/protocol behavior, or claiming broader browser compatibility than the checked-in evidence supports.

## Capabilities

### New Capabilities

- `project-website`: Covers the public website's content, installation journey, responsive and accessible behavior, honest compatibility messaging, and GitHub Pages delivery.

### Modified Capabilities

None.

## Impact

- Adds a new workspace application under `apps/website` and its static production build.
- Adds a GitHub Actions workflow and GitHub Pages repository configuration for deployment.
- Updates workspace metadata and lockfile entries required by the website build.
- Stores only the visitor's language preference in local browser storage; no cookie, account, analytics identifier, or backend service is introduced.
- Links to existing Chrome Web Store, GitHub, README, RFC, and compatibility resources without changing their APIs or requirements.
- Does not alter browser attachment, CDP behavior, control ownership, permissions, releases, package publishing, or any current compatibility classification.
