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
