# Spike 0007: OpenCode ACP

- Date: 2026-08-04
- Runtime: `opencode-ai@1.18.12`
- Result: viable with documented permission-policy and browser-evidence boundaries

## Question

Can Panerelay ship an optional OpenCode Side Panel provider through the existing ACP boundary without changing the shared protocol, injecting browser tooling, or managing OpenCode credentials?

## Reproduction

From the repository root, install the pinned runtime into a disposable directory and run the checked-in probe:

```bash
probe_root=$(mktemp -d /tmp/panerelay-opencode-1.18.12.XXXXXX)
npm install --prefix "$probe_root" --no-audit --no-fund opencode-ai@1.18.12
node packages/bridge/spikes/run-opencode-acp.mjs "$probe_root/node_modules/.bin/opencode"
node --input-type=module -e "import { rm } from 'node:fs/promises'; await rm(process.argv[1], { recursive: true, force: true })" "$probe_root"
```

The probe creates and removes separate XDG state and workspace directories. It removes credential-like environment variables, uses an isolated `permission.* = ask` policy for the approval check, and prints only capability counts and terminal classifications—not prompts, model output, session IDs, tool arguments, or local paths.

## Observations

- Initialization returned ACP protocol 1 and OpenCode 1.18.12 agent metadata.
- Capabilities included session load/list/resume/fork/close, embedded context, image input, and HTTP/SSE MCP.
- Session list, new, load, model selection, text prompt, PNG prompt, cancel, and close all succeeded.
- Real notifications included text, reasoning, tool-call, tool-call-update, usage, and available-command updates.
- The isolated permission policy emitted one request; selecting its reject option prevented the requested file from being created.
- New/load used an empty `mcpServers` array, and no Panerelay, agent-browser, or Browser Use tool activity appeared.
- The final run closed the session, closed ACP, terminated on `SIGTERM`, and left no temporary runtime, profile, workspace, log, or process behind.

## Decision

Use the existing ACP v1 package dependency through a profile-driven internal provider core. Keep `opencode acp` fixed, retain OpenCode's own configuration and authentication, preserve listed session directories, and expose only provider-neutral conversation events.

Do not claim that every OpenCode action creates a Side Panel approval: OpenCode's default build-agent policy allows most actions. Panerelay forwards permission requests when OpenCode emits them and leaves stricter `ask` policy configuration to the user. Browser-tool compatibility remains Forwarded until a dedicated shared-Chrome run is retained.
