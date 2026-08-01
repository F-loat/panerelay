## Context

See [proposal.md](./proposal.md) for motivation. Today `@panerelay/browser-use` probes the `browser-use` executable and the installed Python distributions for Browser Use and Browser Harness, while setup, doctor, and documentation compare both versions by exact equality and expose two requirements. Upstream Browser Use owns and pins Browser Harness as the implementation behind its CLI, daemon, Skill fallback, and CLI MCP path. Panerelay still needs the internal probe because an incomplete Python environment cannot run those surfaces.

RFC-0007 remains the durable architecture for the adapter, private persistent lane, bootstrap, authorization, and cleanup behavior. This change only revises its compatibility and presentation policy. The exact Browser Use 0.13.7 / Browser Harness 0.1.8 run remains the reproducible Verified record; agent-browser 0.33.0 compatibility groups are unaffected.

## Goals / Non-Goals

**Goals:**

- Accept stable semantic versions at or above the Browser Use and internal runtime floors.
- Give users and Agents one actionable Browser Use installation status.
- Preserve exact-version evidence separately from the broader eligibility gate.
- Keep runtime completeness failures fail-closed.

**Non-Goals:**

- Do not change Browser Use, Browser Harness, or any upstream package.
- Do not make the Python SDK transparently inherit the Panerelay connection.
- Do not change browser ownership, explicit tab authorization, leases, CDP forwarding, target lifecycle, or Native Host lifetime.
- Do not claim that every newer eligible version is Verified.

## Decisions

### Use local, bounded semantic-version floor helpers

`@panerelay/browser-use` will own the compatibility predicate used by both its adapter doctor and setup. It will accept stable `major.minor.patch` releases at or above the floors and fail closed for missing, malformed, or prerelease values. Keeping the predicate in the integration package avoids coupling setup to Browser Harness details or importing Bridge platform helpers across an unrelated boundary.

Alternative: exact equality is maximally conservative but needlessly blocks patch and minor Browser Use updates. A general semver dependency would add package weight for a three-component floor check. Treating malformed or prerelease versions as compatible would weaken the floor.

### Keep Browser Harness probing internal and collapse public status

The existing metadata probe will continue returning the internal Browser Harness version because the executable alone does not prove that Browser Use CLI-backed workflows are runnable. One compatibility predicate will require both floors, while public doctor results will emit only `browser-use`. A missing or old internal runtime will be described as an incomplete Browser Use installation and remediated by repairing or upgrading Browser Use.

Alternative: stop probing Browser Harness. This creates false-positive setup results for broken or partially installed Browser Use environments. Exposing a separate check transfers upstream package-graph knowledge to users and implies unsupported direct management.

### Separate eligibility from evidence classification

The minimum gate answers whether Panerelay will attempt the integration. The compatibility record answers what exact version pair was exercised and remains Verified. Newer eligible pairs inherit no automatic Verified claim; observed behavior can still be Forwarded, Partial, or Unsupported until separately recorded.

Alternative: declare all newer versions Verified. A semantic version comparison cannot demonstrate protocol or daemon compatibility, so that would overstate evidence.

### Keep stored internal metadata for diagnostics and lifecycle decisions

Panerelay-owned setup configuration may retain the detected Browser Harness version for internal comparison and troubleshooting. It is not rendered as a user prerequisite. This avoids a configuration migration and preserves enough information to decide whether generated launcher state can be reused.

## Risks / Trade-offs

- **[A newer Browser Use release makes a breaking runtime change despite a higher version]** → The gate only marks it eligible, not Verified; explicit failures remain closed and the compatibility record stays exact.
- **[Prerelease users expect a numerically newer build to pass]** → Reject prereleases until explicitly tested so the minimum has stable-release semantics.
- **[A broken Browser Use environment fails without naming the internal package]** → Provide clear repair/reinstall guidance and retain internal version detail in non-user-facing state and developer diagnostics where needed.
- **[User-facing references drift and reintroduce Browser Harness]** → Cover doctor output and generated Skill text with tests and update public READMEs together.

## Migration Plan

Release the compatibility helper, consolidated diagnostics, and documentation in one Panerelay version. Existing setup configuration remains readable; the next setup or doctor run reevaluates it using minimum floors. Rollback restores exact comparisons and separate messages without changing user Browser Use configuration or Panerelay browser state.
