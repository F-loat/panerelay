# OpenCode 1.18.12 compatibility

- Panerelay release: current development candidate
- Integration: user-installed OpenCode CLI 1.18.12
- Provider ID: `opencode`
- ACP protocol: 1
- Last verified: 2026-08-04

## Status meanings

- **Verified**: covered by deterministic Bridge, setup, Extension, and packaging tests and, where noted, exercised against the real OpenCode 1.18.12 ACP runtime.
- **Forwarded**: uses a supported OpenCode or Panerelay surface, but the relevant real browser or user-configured integration has not been exercised.
- **Partial**: the primary workflow is supported with a documented compatibility limitation.
- **Unsupported**: Panerelay does not expose the operation or fails it explicitly.

## Runtime boundary

Panerelay does not install, bundle, authenticate, or configure OpenCode. Setup discovers a user-owned `opencode` executable, records its normalized path and version, and treats absence as an optional warning. The Bridge starts the closed command `opencode acp`, negotiates ACP protocol 1, and keeps OpenCode-native messages inside the Bridge. Users authenticate and manage models, agents, tools, MCP servers, plugins, and permissions with OpenCode itself.

The real-runtime probe installed `opencode-ai@1.18.12` in a temporary directory, used isolated XDG data/config/cache/state directories, removed credential-like environment variables, and selected `opencode/deepseek-v4-flash-free` through the ACP model configuration option. It did not write machine-specific output into the repository. The reusable probe is [`packages/bridge/spikes/run-opencode-acp.mjs`](../../packages/bridge/spikes/run-opencode-acp.mjs), and the observations are summarized in [spike 0007](../spikes/0007-opencode-acp.md).

## Provider and conversations

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Executable and version discovery | Verified | macOS/Linux/Windows candidates include explicit configuration, `PATH`, npm wrappers, user-local locations, and the official `~/.opencode/bin` fallback. Wrapper and failed-probe tests keep local paths and command output private. |
| Provider discovery and setup guidance | Verified | AgentService registers OpenCode independently; setup, doctor, and the Side Panel expose localized install, `opencode auth login`, and ACP documentation guidance. Missing OpenCode remains a warning. |
| ACP initialization | Verified | OpenCode 1.18.12 returned protocol 1, its exact agent name/version, and capabilities for load, list, resume, fork, close, embedded context, image input, and HTTP/SSE MCP. The probe retains no stderr content and reports only its bounded byte count. |
| Session list, new, and load | Verified | The isolated runtime listed zero initial sessions, returned an opaque ID for `session/new`, and loaded the created session. Panerelay sends an empty `mcpServers` array and preserves the session working directory for later load/resume. |
| Text and reasoning streaming | Verified | A real prompt completed with `end_turn` and emitted bounded agent-message and agent-thought chunks. Deterministic tests cover fragmented and oversized update handling. |
| Tool activity and token usage | Verified | The real runtime emitted tool-call, tool-call-update, and usage-update notifications; provider tests cover sanitized status, failure detail, and usage mapping. |
| PNG image input | Verified | OpenCode advertised ACP image capability and a real one-pixel PNG prompt completed with `end_turn`. Extension and Bridge bounds remain four images, 10 MiB each, and 20 MiB total. |
| Interruption | Verified | Immediate `session/cancel` settled the real prompt with `cancelled`; provider tests cover permission cancellation and one terminal event. |
| Session close and process cleanup | Verified | `session/close` succeeded and the final real probe exited after the ACP connection closed and `SIGTERM` was sent. The Bridge retains a bounded `SIGKILL` fallback if a future runtime does not exit. |

## Permissions, tools, and browser integration

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| ACP permission response | Verified | With isolated OpenCode configuration setting `permission.*` to `ask`, real file-write requests exercised both rejection and `allow_once`. Rejection left its target absent; the correlated one-time approval created only its target with the expected bounded content. |
| Default OpenCode permission policy | Partial | Panerelay preserves the user's OpenCode policy. OpenCode's shipped build agent allows most actions by default and asks only for selected boundaries such as external directories; project reads, edits, and commands are therefore not guaranteed to create Side Panel approvals. Configure OpenCode permissions to `ask` where interactive approval is required. See the [OpenCode permissions reference](https://opencode.ai/docs/permissions/). |
| OpenCode-owned MCP, plugins, skills, and tools | Forwarded | Panerelay neither injects nor removes these definitions. OpenCode loads its isolated or user-owned configuration normally, and Panerelay cannot claim compatibility for arbitrary third-party integrations. |
| Panerelay browser-tool injection | Verified | New/load requests contain `mcpServers: []`; the isolated real probe observed no Panerelay, agent-browser, or Browser Use tool update. |
| User-configured browser tools | Forwarded | A browser tool configured in OpenCode may connect through Panerelay independently, but still requires explicit Chrome authorization and a current control lease. No OpenCode 1.18.12 shared-browser acceptance run is recorded. |
| Side Panel model/mode controls | Unsupported | OpenCode exposes model and mode configuration through ACP, but this release intentionally leaves selection to OpenCode configuration and does not add provider-specific controls to the shared Side Panel. |
| Side Panel authentication flow | Unsupported | Panerelay shows the `opencode auth login` command and documentation but does not proxy credentials or implement ACP authentication UI. |

Provider-native prompts, output, tool arguments, and permission metadata are not logged by default. The Extension receives only bounded provider-neutral events.
