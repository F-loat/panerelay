# Spike 0003: agent-browser advanced command coverage

- Status: In progress
- OpenSpec change: `expand-agent-browser-capabilities`
- RFC: [RFC-0002](../rfcs/0002-browser-level-provider.md)
- agent-browser baseline: `0.33.0`

## Question

Which advanced agent-browser commands work correctly through PaneRelay's authorized daily-Chrome
targets, and which gaps belong to the Provider, Extension, browser ownership, or local environment?

## Safety boundary

The acceptance workflow mutates only the checked-in local fixture. Before the first mutating
command, the runner verifies that the selected PaneRelay target has the same origin as
`PANERELAY_FIXTURE_URL`. Evidence is written outside the repository.

The workflow never runs `agent-browser cookies clear`: Chrome implements it as
`Network.clearBrowserCookies`, which clears cookies across the daily profile. A fixture cookie is
removed by setting only that cookie with an expired timestamp.

HAR, request-detail, credential, upload, download, emulation, trace, profile, and recording inputs
contain generated fixture data only. The runner resets headers, offline mode, request routes,
storage, and the fixture cookie, then closes the Agent session.

## Run the fixture

```bash
node docs/spikes/fixtures/rfc0001-actions/server.mjs
```

Open `http://127.0.0.1:41731/` in Chrome and authorize that tab in PaneRelay. The default port can
be changed with `PANERELAY_FIXTURE_PORT`.

## Run acceptance groups

```bash
pnpm run acceptance:agent-browser baseline
pnpm run acceptance:agent-browser state-network
pnpm run acceptance:agent-browser artifacts
pnpm run acceptance:agent-browser emulation
pnpm run acceptance:agent-browser diagnostics
```

Use `all` only after the groups pass independently. Override the session, fixture, or evidence
directory when required:

```bash
PANERELAY_ACCEPTANCE_SESSION=panerelay-advanced \
PANERELAY_FIXTURE_URL=http://127.0.0.1:41731/ \
PANERELAY_EVIDENCE_DIR="$HOME/verify-evidence/panerelay/advanced-manual" \
pnpm run acceptance:agent-browser all
```

The runner rejects non-loopback fixture URLs, evidence directories inside the repository, and
agent-browser versions other than `0.33.0`.

## Result classification

- **Provider**: the agent-browser plugin launch, cleanup, or option contract is wrong.
- **Extension**: target authorization, debugger attachment, CDP forwarding, or Native Messaging
  transport changes the command's correct target-scoped behavior.
- **Browser ownership**: the command requires process, browser-context, launch, or profile control
  that PaneRelay intentionally does not own.
- **Environment**: the command depends on unavailable local browser or operating-system support.

Only commands with automated coverage and a representative authorized daily-Chrome run can move
to `Verified` in the compatibility matrix.

## Pre-change baseline

Run on 2026-07-29 with agent-browser `0.33.0`, daily Chrome `150.0.7871.187`, the unpacked
PaneRelay Extension, and the loopback fixture:

| Capability group            | Result                                                                        | Classification before implementation                     |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| local/session storage       | Passed set, get, and cleanup                                                  | No PaneRelay gap                                         |
| cookies                     | Passed target-origin set, get, observation, and single-cookie expiry          | Global clear is a browser-ownership and privacy boundary |
| headers and credentials     | Passed safe header echo, Basic credential challenge, and reset                | No PaneRelay gap                                         |
| request list/detail and HAR | Passed fixture request detail and a one-entry readable HAR                    | No PaneRelay gap                                         |
| offline and Fetch routes    | Passed offline observation, route response, unroute, and restored response    | No PaneRelay gap                                         |
| PDF                         | Passed with a readable 127,791-byte, one-page PDF                             | No PaneRelay gap                                         |
| upload                      | Passed Agent-local file selection and page-observed name/size                 | No PaneRelay gap                                         |
| download to an Agent path   | Failed at `Browser.setDownloadBehavior` on a tab debuggee                     | Browser ownership                                        |
| viewport and media          | Passed 480×720 viewport, dark scheme, and reduced motion                      | No PaneRelay gap; real Chrome window is unchanged        |
| accessibility audit         | Passed structured axe output with a selector path into the same-origin iframe | No PaneRelay gap                                         |
| trace and profiler          | Passed readable 541,713-byte trace and 139,237-byte profile                   | No PaneRelay gap                                         |
| `record start`              | Failed explicitly at `Target.createBrowserContext`                            | Browser ownership; isolated contexts remain unsupported  |

External evidence:

- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T115543-516Z`
- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T115413-350Z`
- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T115601-197Z`
- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T115442-031Z`

The baseline exposed one PaneRelay clarity gap: browser-process methods sent through a virtual page
session were reaching the tab debuggee and returning Chrome's generic “method not found” response.
The implementation should reject those methods at the Bridge with an ownership-specific error. It
also exposed a privacy gap in theoretical forwarding: whole-profile cookie methods must not reach
the user's daily Chrome even when agent-browser addresses them through a page session.

## Implemented result

The Bridge now rejects Browser-domain process commands with an ownership-specific CDP error even
when agent-browser sends them through a virtual page session. It also blocks whole-profile cookie
read/clear methods and limits explicit cookie URLs and domains to the selected authorized target.
The normal same-origin cookie, storage, Network, Fetch, Emulation, Accessibility, PDF, upload,
trace, profiler, and stream workflows continue through the generic target-scoped relay.

Post-change daily-Chrome evidence:

- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T120207-124Z`
- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T120217-641Z`
- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T120246-803Z`
- `~/verify-evidence/panerelay/agent-browser-advanced/2026-07-29T120334-912Z`

The post-change artifact run produced a readable 4,338,652-byte PDF, exercising multi-frame Native
Messaging reconstruction. Download now fails with the explicit PaneRelay
`Browser.setDownloadBehavior requires browser-process ownership` error.

`record start` remains unsupported because agent-browser creates an isolated browser context. The
target-scoped `record restart` path reached Chrome screencast successfully, but this machine lacks
ffmpeg, so agent-browser could not package the frames as WebM. The failure left the session usable,
stream status remained observable, stream cleanup passed, and a fresh Provider session worked.

Timezone and locale remain `Forwarded`: PaneRelay's contract coverage confirms the target-scoped
Emulation commands, but agent-browser `0.33.0` does not expose them through its CLI or MCP tools.
