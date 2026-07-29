## 1. Controlled favicon

- [x] 1.1 Generate the agent-browser favicon variant with a white-ringed green control dot
- [x] 1.2 Inject a document-local override that preserves original icon nodes and resists SPA
      replacement
- [x] 1.3 Restore the original favicon idempotently on release

## 2. Extension lifecycle

- [x] 2.1 Apply the indicator only after a target becomes actively controlled
- [x] 2.2 Reapply it after navigation while the target remains controlled and authorized
- [x] 2.3 Restore it for target detach, complete lease release, and debugger displacement
- [x] 2.4 Add the constrained `scripting` permission without changing optional host patterns

## 3. Tests and documentation

- [x] 3.1 Cover icon identity, injection arguments, restoration, idempotence, and best-effort failure
- [x] 3.2 Update RFC-0002 and the agent-browser 0.33.0 compatibility matrix
- [x] 3.3 Run Extension tests/typecheck/build, the full repository check, OpenSpec validation, and
      `git diff --check`

## 4. Daily Chrome acceptance

- [ ] 4.1 Reload the unpacked Extension and verify a controlled local fixture shows the marked
      agent-browser favicon
- [ ] 4.2 Verify navigation keeps the indicator and Provider cleanup restores the fixture favicon
- [ ] 4.3 Remove temporary browser state, sync completed evidence, and archive the OpenSpec change
