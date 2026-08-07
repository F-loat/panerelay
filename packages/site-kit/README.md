# `@panerelay/site-kit`

Public authoring and build toolkit for Panerelay fetch site adapters. A site is ordinary TypeScript with one command per file; it does not need a `package.json`, `tsconfig.json`, handwritten manifest, or build script.

```text
panerelay.site.ts
commands/me.ts
commands/me.test.ts        # optional
shared.ts                  # optional relative module
```

Create and validate a site:

```bash
npx --yes @panerelay/site-kit init ./my-site --id example
npx --yes @panerelay/site-kit check ./my-site
npx --yes @panerelay/site-kit test ./my-site
npx --yes @panerelay/site-kit build ./my-site --out ./example-adapter
```

`build` writes exactly `panerelay-fetch-adapter.json` and a self-contained `adapter.mjs`. `check` performs the same build in temporary storage and removes it. `test` is the only command that executes author test code; checking and building discover metadata statically and never run the site modules or repository scripts.

## Source API

`panerelay.site.ts` exports literal site metadata:

```ts
import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'example',
  name: 'Example',
  version: '0.1.0',
  description: 'Example commands using the current browser session.',
});
```

Each direct `commands/*.ts` file exports one matching command. Literal help metadata stays beside its handler:

```ts
import { defineCommand } from '@panerelay/site-kit';

export default defineCommand({
  name: 'me',
  description: 'Show the current profile.',
  access: 'read',
  args: [],
  output: ['name'],
  examples: ['panerelay example me'],
  async run(context) {
    const response = await context.fetch({
      url: 'https://example.com/api/me',
      responseType: 'json',
      withCookies: true,
    });
    return response.body;
  },
});
```

Production source may import relative TypeScript modules, `node:` built-ins, and `@panerelay/site-kit`. Other package imports, source-root escapes, symbolic links, and computed metadata are rejected. Browser site permission and Panerelay domain policy remain separate runtime concerns.
