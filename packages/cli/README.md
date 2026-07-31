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

The CLI lists live Panerelay browser registrations and manages the saved routing
default. It does not install or control an automation engine, grant site access,
authorize tabs, or change control leases. Browser automation remains the
responsibility of integrations such as agent-browser or browser-use.

Use [`@panerelay/setup`](https://www.npmjs.com/package/@panerelay/setup) for
one-time installation, diagnostics, updates, and uninstall.
