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

Setup-managed connection adapters can also expose engine-neutral mode and run operations. The examples below use a globally installed `panerelay` command. The Browser Use Skill instead uses the dedicated launcher path printed by `@panerelay/setup --browser-use` (normally `~/.panerelay/bin/panerelay-browser-use`):

```bash
panerelay connection use browser-use extension
panerelay connection use browser-use direct
panerelay connection use browser-use extension
panerelay connection use browser-use direct
```

The CLI invokes only the exact child command after `--`, applies only the adapter's declared environment keys, and does not interpret browser-use automation. One-run mode selection does not persist. Extension-mode browser-use uses a user-scoped concurrency lane; sequential processes share the upstream daemon state, while overlapping runs wait briefly or fail explicitly as busy.
