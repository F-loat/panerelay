## 1. CLI transport and history

- [x] 1.1 Implement an injectable Claude CLI child-process adapter with bounded stream-json parsing, stdin messages, terminal result enforcement, stderr capture, and deterministic termination
- [x] 1.2 Replace the internal stdio permission control protocol with a scoped loopback MCP permission tool, including request, response, cancellation, duplicate, stale-request, origin, and cleanup handling
- [x] 1.3 Implement bounded project-aware Claude transcript listing and message normalization without reading subagent transcripts
- [x] 1.4 Enforce the stable Claude Code CLI 2.1.206 version floor in Provider readiness and doctor output

## 2. Provider integration

- [x] 2.1 Replace the SDK facade in ClaudeProvider with CLI launch, session ID/resume, system instructions, image input, MCP config, and provider-neutral event normalization
- [x] 2.2 Preserve one-request approvals, interruption, terminal cleanup, and participant-scoped browser cleanup across success and failure paths
- [x] 2.3 Replace SDK fixtures with deterministic CLI process, stream, MCP permission, malformed-output, and transcript tests on POSIX and Windows command paths

## 3. Distribution and documentation

- [x] 3.1 Remove the Claude Agent SDK dependency, lockfile graph, type imports, and packaged-SDK release gates
- [x] 3.2 Add release checks proving published Panerelay manifests and tarballs contain no Claude SDK or platform runtime
- [x] 3.3 Update Bridge, setup, compatibility, release, and OpenSpec documentation for the external CLI boundary and capability classifications
- [x] 3.4 Reject the Claude Agent SDK from normal and optional source/packed dependencies and cover both manifest shapes

## 4. Validation

- [x] 4.1 Run frozen installation, format, strict lint/typecheck/tests/build, release candidate validation, strict OpenSpec validation, and diff checks
- [ ] 4.2 Run a bounded signed-in Claude CLI acceptance covering stream, resume, approval, interruption, and scoped daily-Chrome browser cleanup when the required local runtime and authorization are available

  Not run on 2026-07-31: no `claude` executable is available on the validation machine. A read-only check against existing local top-level transcript structure passed without retaining conversation content.
