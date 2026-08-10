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

Commands may declare one `file` argument. Panerelay reads only that explicit regular file (up to 12 MiB), removes its local path, and exposes it as `context.artifact(argumentName)`. `createMultipartBody` turns one artifact and bounded text fields into a Base64 browser-fetch body and matching content type. `decodeBase64Bytes`, `decodeBase64Text`, `responseBytes`, `responseText`, `seedSameOriginPage`, and `fetchValidatedJson` cover bounded binary/charset and seed-then-JSON workflows. Throw `SiteError` to return a stable structured failure code.

Site adapters may use the selected browser's Cookie-backed login state, including protected Cookie-to-CSRF bindings. A manifest may also declare a protected exact-origin `localStorage` source, fixed JSON Pointer fallback, fixed destination, and allowed request origins. Only the Extension reads and injects that value from an already-open matching tab; the adapter never receives it. Arbitrary storage reads and `sessionStorage` remain unsupported. Adapters cannot request user-supplied API keys, personal access tokens, client secrets, or other manually configured credentials.

Production source may import relative TypeScript modules, `node:` built-ins, and `@panerelay/site-kit`. Other package imports, source-root escapes, symbolic links, and computed metadata are rejected. Browser site permission and Panerelay domain policy remain separate runtime concerns.
