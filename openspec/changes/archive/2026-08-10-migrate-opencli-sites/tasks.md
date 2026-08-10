## 1. Inventory and planning

- [x] 1.1 Compare the OpenCLI directory list with the current Panerelay catalog and remove duplicate/stale inventory rows.
- [x] 1.2 Classify every non-internal site and record source evidence for Pending/Unsupported items.
- [x] 1.3 Define representative command cases and single-site E2E selection for each migrated site.

## 2. Adapter migration

- [x] 2.1 Migrate all identified fetch-compatible public or cookie-backed site command subsets using the site-kit source contract.
- [x] 2.2 Add migrated sites to the aggregate catalog, build inventory, and package tests.
- [x] 2.3 Preserve explicit omissions for page, interceptor, native, batch/local download, and unsupported write workflows.

## 3. Per-site verification

- [x] 3.1 Run a single-site E2E immediately after each adapter migration and record bounded evidence.
- [x] 3.2 Diagnose failed or blocked sites and either fix the adapter or document the blocking reason.

## 4. Finalization

- [x] 4.1 Update `docs/compatibility/opencli-site-migration.md` with one complete, deduplicated inventory and overall analysis.
- [x] 4.2 Validate OpenSpec artifacts, package tests, full repository checks, and diff hygiene.

## 5. Canonical numeric-leading site IDs

- [x] 5.1 Split adapter-ID validation from command/argument/binding validation, allow lowercase digits only at the start of adapter IDs, and add focused protocol/site-kit rejection and acceptance tests.
- [x] 5.2 Rename `rail12306` to `12306` and `kr36` to `36kr` across source manifests, examples, catalogs, builds, E2E selectors, documentation, and installed adapter state without compatibility aliases.
- [x] 5.3 Run focused package and E2E-coverage tests, strict OpenSpec validation, frozen install, full repository checks, inventory consistency, and diff hygiene.

## 6. Revalidated WAF-backed site

- [x] 6.1 Reclassify 1point3acres after a user-completed Cloudflare challenge, migrate its fetch-compatible command subset, run isolated E2E, and update bounded compatibility evidence.
