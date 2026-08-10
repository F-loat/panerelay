## Why

Fetch and browser automation now have separate authorization models, but the connected Side Panel welcome state exposes only the automation scope and labels it generically as browser access. The root READMEs also make the primary Fetch path harder to scan by mixing advanced MCP setup with ordinary site-adapter and authorization guidance.

## What Changes

- Present the connected ready state as four independent card rows: summarize, operate, `Automation authorization` / `自动化授权`, and `Fetch authorization` / `Fetch 授权`.
- Give the Fetch card explicit current-domain and all-domain choices backed by the existing Fetch authorization controller, while retaining current-tab and all-supported-tabs choices in the automation card.
- Keep each compact selector limited to its two authorization scopes, with no separate release option; selecting the active scope again clears that scope without releasing active control or changing the other authorization model.
- Keep only the summarize-page and operate-page welcome suggestions, removing the redundant find-information suggestion and making the second action task-oriented.
- Keep full authorized-domain management in Settings and preserve independent Fetch-domain, automation-tab, and active-control state.
- Reorder the root README Fetch guide so site adapters and `add --all` appear before domain authorization, move external Agent MCP setup into the collapsed advanced section, replace the text architecture diagram with Mermaid, and credit the OpenCLI project that supplied the migrated site implementations.
- Add direct regression coverage for `npx --yes @panerelay/setup add --all`, which is already part of the accepted setup contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `guided-browser-readiness`: The connected ready welcome state presents two focused Agent suggestions followed by independent automation-tab and Fetch-domain authorization cards.
- `project-website`: The root English and Chinese README contract becomes Fetch/Connect-first, keeps external MCP configuration collapsed, documents all-built-in site installation, credits OpenCLI, and uses a Mermaid architecture diagram.

## Non-goals

- Do not merge Fetch-domain authorization with automation-tab authorization or active control.
- Do not change Chrome Host Permission behavior, grant permissions without a direct user action, or expose the full arbitrary-domain manager in the compact welcome surface.
- Do not change browser ownership, launch profiles, proxy settings, automation semantics, or the agent-browser 0.33.0 compatibility baseline.

## Impact

- Extension Side Panel copy, compact welcome components, styling, and component tests.
- Root English and Simplified Chinese READMEs plus release documentation tests.
- Setup CLI help and tests for the existing all-built-in adapter path.
- No protocol, Bridge, browser-ownership, or compatibility-group changes; Chrome and Edge continue to share the existing Extension authorization behavior.
