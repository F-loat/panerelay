## Why

Browser Use currently receives Panerelay connection state only when launched through a Panerelay wrapper, while agent-browser reads its configured Provider directly. This prevents `connection use browser-use extension` from affecting an ordinary `browser-use` process and makes the two integrations asymmetrical.

## What Changes

- **BREAKING** Replace the Browser Use wrapper-owned connection bootstrap with a setup-managed, user-scoped fixed CDP discovery endpoint.
- **BREAKING** Make Browser Use Extension mode a Browser Harness environment default so the official `browser-use` CLI and CLI MCP use Panerelay without a Panerelay launcher.
- Add a user-scoped Browser Use gateway with a stable loopback URL that resolves the saved Panerelay browser default, creates the existing short-lived participant credential, and forwards Browser Harness's `/json/version` response.
- Move Browser Use mode/environment persistence into the Browser Use integration configuration instead of relying on `@panerelay/cli run` to inject child variables.
- Keep dynamic participant credentials, browser generation binding, authorization checks, revocation, lane serialization, and unsupported browser-process operations fail-closed.
- Remove the dedicated Browser Use launcher and wrapper-specific Skill/MCP instructions; document the official `browser-use` and `browser-use --cli-mcp` commands.
- Update compatibility evidence and RFC-0007 to describe the fixed discovery endpoint and its same-user loopback trust model.

## Capabilities

### New Capabilities

- `browser-use-environment-default`: Configure Browser Use's environment so the official CLI and CLI MCP resolve the Panerelay Browser Use connection by default.
- `browser-use-gateway`: Provide a stable loopback CDP discovery endpoint that routes Browser Use to the selected authorized browser while retaining short-lived participant credentials.

### Modified Capabilities

- `browser-use-connection-adapter`: Change Browser Use connection resolution from wrapper-injected ticket URLs to the fixed gateway endpoint and integration-owned environment configuration.

## Impact

- Affected packages: `@panerelay/browser-use`, `@panerelay/bridge`, `@panerelay/cli`, `@panerelay/setup`, and the Extension integration settings service.
- Affected artifacts: Browser Harness environment files, protected Panerelay gateway state, setup Skill/MCP documentation, RFC-0007, and Browser Use compatibility evidence.
- Browser Use remains an external dependency; no upstream fork or SDK interception is introduced.
- The fixed gateway is loopback-only and intentionally available to same-user local processes. It is not a cross-user authentication boundary.
- The pinned compatibility baseline remains Browser Use 0.13.7 with Browser Harness 0.1.8; agent-browser 0.33.0 remains the shared Bridge regression baseline.
