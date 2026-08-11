## 1. Activity Presentation Model

- [x] 1.1 Add a pure renderer helper that groups only maximal adjacent runs of two or more activity timeline items and leaves normalized timeline state unchanged.
- [x] 1.2 Add aggregate status and localized summary metadata for total, failed, and declined activity counts.
- [x] 1.3 Cover grouping, boundary preservation, single-activity behavior, stable ordering, and mixed outcomes with automated tests.

## 2. Side Panel Rendering

- [x] 2.1 Extract the existing individual activity card rendering so ungrouped activities preserve their behavior independently from grouped presentation.
- [x] 2.2 Render collapsed activity groups with the latest title and aggregate outcome, then preserve every individual activity disclosure when expanded.
- [x] 2.3 Add grouped activity styles and component tests for collapsed defaults, expansion, mixed failures, running activity, and retained timeline order.
- [x] 2.4 Replace nested full-size activity cards with lightweight status rows on one shared expanded-list surface while preserving terminal detail disclosures and setup guidance.
- [x] 2.5 Switch the open group heading to a localized activity-log label and update component tests for the non-redundant expanded hierarchy.

## 3. Verification and Documentation

- [x] 3.1 Run targeted Extension tests, formatting, the full workspace check, and `git diff --check`; remove any generated or machine-specific artifacts.
- [x] 3.2 Validate the OpenSpec change and document that provider protocol, pinned agent-browser 0.33.0, and existing compatibility matrices remain unchanged.
- [x] 3.3 Verify in the daily Chrome profile that a long Codex or Qoder browser turn shows one collapsed activity group by default, preserves mixed failure status, and exposes every original activity after expansion.
- [x] 3.4 Re-run targeted Extension tests, formatting, the full workspace check, OpenSpec strict validation, and `git diff --check` after the expanded-list refinement.
