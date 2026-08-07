# `@panerelay/cli`

Optional, engine-neutral browser administration for Panerelay.

Install it when you want a persistent `panerelay` command:

```bash
npm install --global @panerelay/cli
panerelay browsers
panerelay browser use edge
panerelay browser clear
```

For occasional use, no global installation is required:

```bash
npx --yes @panerelay/cli browsers
```

## Browser-backed fetch

The persistent CLI can issue Fetch-shaped requests through one selected live Panerelay Extension:

```bash
panerelay fetch https://api.example.com/me \
  -H 'Origin: https://www.example.com' \
  -H 'Referer: https://www.example.com/' \
  --response json
```

Supported raw options are `--method`, repeatable `--header/-H`, repeatable `--query`, `--data`, `--data-base64`, `--response`, `--timeout`, `--cookies`, `--no-cookies`, and `--browser`. The output is a structured JSON object containing HTTP status, headers, decoded body type, final URL, redirect state, and attached-cookie count. Browser cookies are included by default but never printed or passed through the Bridge protocol as header material.

`Origin` and `Referer` are customizable. When omitted they default to the target origin and `<origin>/panerelay`; an explicit empty value removes the generated header. The target still needs Chrome site access. Panerelay does not query or request that permission before execution, so a Chrome rejection returns guidance to grant site access and retry.

Fetch adapters installed by `@panerelay/setup` use an OpenCLI-like form:

```bash
panerelay fetch --help
panerelay fetch bilibili --help
panerelay fetch bilibili me
panerelay fetch bilibili me --json
panerelay fetch bilibili subtitle BV1xx411c7mD --lang zh-CN
panerelay fetch bilibili comment BV1xx411c7mD 'test' --execute
```

Help reads only protected manifest metadata and does not select a browser. Adapter results use an OpenCLI-style table with an item-count and one-decimal elapsed-time footer by default; like OpenCLI, timing starts when the concrete command action begins and stops before rendering. `--json` prints only the underlying structured result for scripts. Execution verifies the registered digest and runs the adapter once in a bounded child process with a short-lived fetch-only token. Fetch has no Panerelay domain ACL or tab-control lease in this version.

The built-in Bilibili command inventory is `whoami`, `me`, `video`, `search`, `hot`, `ranking`, `dynamic`, `feed`, `feed-detail`, `favorite`, `history`, `following`, `user-videos`, `comments`, `subtitle`, `summary`, `comment`, `follow`, and `unfollow`. The final three are writes. Comment requires `--execute`; each write uses a generic Cookie binding that asks the Extension to inject `bili_jct` as the `csrf` form field without disclosing its value to the adapter. Interactive `login` and media/filesystem-oriented `download` are excluded.

Once `<site> <command>` has been parsed, manifest-declared `--lang` remains a command argument. A global CLI locale must appear before `fetch`, such as `panerelay --lang zh-CN fetch bilibili --help`.

The CLI lists live Panerelay browser registrations and manages the saved routing default. It does not install or control an automation engine, grant site access, authorize tabs, or change control leases. Browser automation remains the responsibility of integrations such as agent-browser or browser-use.

Use [`@panerelay/setup`](https://www.npmjs.com/package/@panerelay/setup) for one-time installation, diagnostics, updates, and uninstall.

Setup-managed connection adapters can also expose engine-neutral mode operations. The examples below use a globally installed `panerelay` command. Browser Use itself is invoked through the official `browser-use` command; setup manages its Browser Harness environment default:

```bash
panerelay connection use browser-use extension
panerelay connection use browser-use direct
```

The CLI does not interpret browser-use automation. The saved mode controls the managed Browser Harness environment file. In Extension mode it contains:

```dotenv
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use
```

The official `browser-use` and `browser-use --cli-mcp` commands read this variable directly. It is a fixed loopback discovery URL; Panerelay still selects the saved browser and creates short-lived CDP credentials behind it. Extension-mode browser-use uses a user-scoped concurrency lane; sequential processes share the upstream daemon state, while overlapping runs wait briefly or fail explicitly as busy. Direct mode removes Panerelay-managed Browser Harness keys.
