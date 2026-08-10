# Spike 0009: Site catalog build performance

- Date: 2026-08-11
- Status: Verified locally
- OpenSpec change: `optimize-site-catalog-build`
- Governing RFC: [RFC-0009](../rfcs/0009-browser-backed-fetch-and-site-adapters.md)

## Question

Can the 99 built-in adapters retain RFC-0009's bounded source inspection, restricted types and imports, self-contained runtime, strict two-file format, and fail-closed validation while avoiding one TypeScript program and one bundler invocation per site?

## Baseline

The pre-change `packages/sites/build.mjs` called `buildSite` serially for every built-in adapter. Each call independently traversed one source graph, created a TypeScript `Program`, ran esbuild, validated its artifacts, and replaced one adapter directory.

The catalog contained 99 adapters and 700 TypeScript source files. On the same development machine with Node.js 20.19.5 and pnpm 10.34.5:

```bash
/usr/bin/time -l node packages/sites/build.mjs
```

completed in 65.24 seconds with a maximum resident set size of 1,715,666,944 bytes. The root `check` command could reach this catalog build six times through its typecheck, package test, setup build, and final build phases. The sites `dist` tree occupied about 7.0 MiB because ordinary TypeScript emission retained redundant per-site source trees alongside the 3.1 MiB installable adapter catalog.

## Implemented probe

The optimized path:

1. traverses and statically validates each selected source graph in deterministic catalog order;
2. creates one restricted TypeScript `Program` over the union of selected production source files;
3. runs one multi-entry esbuild operation with code splitting disabled, producing one standalone entry for each site;
4. writes and revalidates the complete catalog in staging before atomically replacing the destination;
5. compiles only the sites package entry and package test through its ordinary TypeScript configuration; and
6. makes root validation build the workspace once, then run no-emit typechecks and already-compiled tests.

The public single-site builder remains independent and retains its existing source and output contract.

## Results

| Probe | Before | After | Change |
| --- | --: | --: | --: |
| Direct catalog build wall time | 65.24 s | 9.91 s | 84.8% lower |
| Direct catalog build maximum RSS | 1,715,666,944 B | 425,181,184 B | 75.2% lower |
| First complete sites package build | Not separately recorded | 19.06 s | Includes clean and TypeScript package emission |
| Complete sites package build maximum RSS | Not separately recorded | 420,823,040 B | Includes clean and TypeScript package emission |
| Catalog builds reachable from root `check` | 6 | 1 | 5 duplicate builds removed |
| Sites `dist` size | About 7.0 MiB | 3.1 MiB | Redundant emitted source trees removed |

The direct after measurement used the same command as the baseline after the optimized implementation had produced a valid catalog. The first complete package build used:

```bash
/usr/bin/time -l pnpm --filter @panerelay/sites run build
```

Filesystem cache state is not controlled, so absolute wall times are development evidence rather than CI gates. The structural one-program, one-bundler, and one-root-build properties have automated regression coverage and do not depend on timing.

## Correctness verification

- Site-kit fixtures passed single-site behavior, deterministic batch identities, duplicate and mismatched IDs, site-qualified type diagnostics, exact outputs, previous-catalog preservation, ownership refusal, and staging cleanup.
- The real catalog built all 99 adapters and its package test revalidated every manifest, ID, version, entry, and exact two-file directory.
- A packed `@panerelay/sites` tarball contained 99 manifests, 99 standalone entries, the public package entry, README, license, and metadata, with no compiled tests or per-site source tree.
- One workspace build, all package typechecks, all compiled package tests, and root script tests passed. Static orchestration coverage rejects nested sites builds or build commands inside `test:compiled`.

## Conclusion

The catalog is a suitable compilation unit. Reusing TypeScript and esbuild work across the bounded source set materially reduces both time and memory while preserving the installed format and independent single-site workflow. A worker pool, persistent cache, or new monorepo task runner is not justified by the remaining catalog cost.

This spike changes no browser, fetch, adapter-runtime, authorization, control, or compatibility behavior. Daily-Chrome verification and compatibility-matrix updates are therefore not applicable. No CPU profile, generated adapter, tarball, test log, browser state, or machine-specific path is retained as evidence.
