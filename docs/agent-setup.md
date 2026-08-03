# Panerelay setup instructions for Agents

Use this guide when a user asks you to connect Panerelay to the Chrome or Microsoft Edge browser they already use. Follow the scenario named by the user. If no scenario is specified, ask them to choose Panerelay only, agent-browser, browser-use, or both before changing the environment.

Respond in the user's language. Inspect first, make only the required changes, stop for user-controlled browser actions, and report evidence instead of assuming success.

Canonical URL: <https://f-loat.github.io/panerelay/agent-setup.md>

## Goal and boundaries

Panerelay connects local Agents and supported automation tools to browser tabs the user explicitly authorizes. The browser profile, cookies, and signed-in state stay in the browser. Setup does not authorize a site or tab, and focus never grants authorization.

The `@panerelay/setup` package installs Panerelay's Native Host and the selected Panerelay integration files. It does **not** install, update, downgrade, rewrite, or add `agent-browser` or `browser-use` to `PATH`.

| Scenario | Upstream tool required | Panerelay result |
| --- | --- | --- |
| Panerelay only | None | Native Host and side-panel prerequisites |
| agent-browser | agent-browser 0.33.0+ | Provider and additive Skill |
| browser-use | browser-use 0.13.7+ with its complete CLI runtime | Adapter, private CLI, additive Skill, and CLI MCP launcher |
| Both | Both supported tools | Both explicit integrations |

## Safety and scope

- Do not modify unrelated Agent configuration, browser profiles, credentials, projects, shell startup files, or third-party packages.
- Use an existing supported tool installation when available. Install or update an upstream tool only when it is missing or below Panerelay's supported minimum.
- Follow the upstream project's current official installation method. Do not pipe a remote installer into a shell without first identifying the source and confirming that it belongs to the selected scenario.
- Do not enable Panerelay as the project or user default agent-browser Provider unless the user explicitly asks for that additional change.
- Never infer permission from the active browser, focused tab, setup success, or tool selection.
- Do not export cookies, credentials, or browser profile data as part of setup or verification.

## 1. Inspect the environment

1. Identify the operating system and available shell.
2. Confirm Node.js 20 or newer is available. If it is missing or too old, explain the requirement and ask before changing a system-level runtime.
3. Check only the tools selected by the user:
   - `agent-browser --version`; Panerelay requires 0.33.0 or newer.
   - `browser-use --help` to confirm that the CLI is available. Panerelay setup and doctor probe the installed package and Browser Harness versions directly; they require browser-use 0.13.7 or newer with its complete CLI runtime. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8.
4. Record whether each selected tool is missing, supported, or below the minimum.

## 2. Install or update selected upstream tools only when needed

Use the current official instructions:

- agent-browser: <https://agent-browser.dev/installation>
- browser-use CLI: <https://docs.browser-use.com/open-source/browser-use-cli>

After any upstream installation or update, repeat the relevant availability check. For browser-use, let Panerelay setup and doctor perform the exact package-version check. Do not continue if the executable remains unavailable or Panerelay reports an unsupported version. Do not install either upstream tool for the Panerelay-only scenario.

## 3. Run the selected Panerelay scenario

### Panerelay only — Agent side panel

Use this when the user needs the Panerelay side panel and local Agent providers, without an external automation integration.

```sh
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
```

### agent-browser

Run only after confirming a supported `agent-browser` executable:

```sh
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup doctor --agent-browser
```

### browser-use

Run only after confirming a supported browser-use CLI and complete runtime:

```sh
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Preserve browser-use's CLI, CLI MCP, and helper semantics. Panerelay supplies only the explicitly authorized existing-Chrome connection.

### agent-browser and browser-use

Run only after confirming both supported upstream tools:

```sh
npx --yes @panerelay/setup --agent-browser --browser-use
npx --yes @panerelay/setup doctor --agent-browser --browser-use
```

## 4. Stop for browser actions owned by the user

- If the Panerelay Extension is missing, stop and ask the user to install the official [Chrome Web Store build](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi). Microsoft Edge may ask them to allow extensions from other stores.
- Stop and ask the user to authorize the intended test tab in the Panerelay Extension when verification requires browser access.
- Do not click authorization controls on the user's behalf or treat an empty tab list as permission to widen the scope.

Resume only after the user confirms the required browser action.

## 5. Verify the result

For every scenario, re-run the matching doctor command and require all selected checks to pass.

When agent-browser is selected, verify the authorization boundary after the user authorizes a test tab:

```sh
agent-browser --provider panerelay tab list
```

The result must contain only tabs the user explicitly authorized. An empty list is expected when no eligible tab is authorized and must not be reported as installation success or failure by itself.

When browser-use is selected, require the browser-use compatibility and Extension-connection doctor checks to pass. Then use the exact setup-managed launcher and browser-use executable paths printed by setup to run its pre-imported `list_tabs()` helper and confirm that it returns only explicitly authorized tabs. Preserve the normal setup-managed CLI, additive Skill, and CLI MCP workflow; do not substitute an arbitrary Python SDK construction as the verification path.

## Acceptance report

Report one of two outcomes: **completed and verified** or **user action still required**. Include:

- detected operating system, Node.js version, and selected upstream tool versions;
- whether each upstream tool was already present, installed, or updated, including the official source used;
- the exact Panerelay setup and doctor commands run;
- whether the Extension connected and every selected doctor check passed;
- whether agent-browser listed only explicitly authorized tabs, when selected;
- whether Browser Harness listed only explicitly authorized tabs, when browser-use was selected;
- any remaining user action, especially installing the Extension, authorizing a tab, or restarting a terminal after an upstream installer changed `PATH`.

Do not claim completion when a required doctor check failed, the Extension is disconnected, or a required authorization boundary was not verified. Report the failing check and the smallest next action instead.

Advanced reference:

- [`@panerelay/setup` technical reference](https://github.com/F-loat/panerelay/blob/main/packages/setup/README.md)
- [Panerelay project quickstart](https://github.com/F-loat/panerelay#quickstart)
- [Compatibility records](https://github.com/F-loat/panerelay/tree/main/docs/compatibility)
