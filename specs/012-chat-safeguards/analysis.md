# Specification Analysis Report

**Feature**: `012-chat-safeguards`
**Date**: 2026-10-20
**Purpose**: Preserve the in-session `speckit-analyze` report for the design owner and Claude.

Reviewed [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md), supporting artifacts,
the [constitution](../../.specify/memory/constitution.md), and the pinned pi `v1.3.0` source.
Locations below are relative to this feature directory unless otherwise stated.

Resolve the findings below before implementation. This report records the earlier analysis;
it does not change the design or authorize remediation. No source artifact or application code
was changed during analysis.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|---|
| C1 | Constitution | CRITICAL | `spec.md:61` | The clarification includes a Chinese literal outside the constitution's permitted exceptions for non-English text. | Describe the rejected alternative in English. |
| C2 | Constitution / test coverage | CRITICAL | `spec.md:249-261`; `plan.md:106-110` | Listed edge cases lack explicit planned tests: preserving a draft during failure, failure during regenerate, and `/prev` after external session-file edits. The constitution requires testing listed edge cases or recording complexity-based deferrals. | Add these cases to the test plan and tasks, or assess and explicitly defer them. |
| I1 | Inconsistency | HIGH | `spec.md:259,333-334`; `tasks.md:133-135` | SC-002 promises spending cannot exceed $1 without consent, but the planned check only runs before requests. A request starting at $0.99 can cross $1 without consent. | Align SC-002 with the documented threshold behavior, or obtain a design decision for a stronger guarantee. |
| I2 | Inconsistency | HIGH | `spec.md:181-185,292-295`; `tasks.md:153-156` | FR-010 and scenario 3 say another regenerate leaves nothing to restore; scenario 4 and T009 require A to B to C to restore B. | Distinguish clearing the old slot at regenerate start from populating it after completion. |
| I3 | Inconsistency | HIGH | `spec.md:276-278`; `contracts/messages.md:19-21` | FR-003 requires the retry count in failure notices, but the exact contract omits it for rejected-key, no-credit, and unavailable-model notices. Only the innkeeper exception is explicitly clarified. | State which failure kinds show counts, then align the requirement and contract. |
| I4 | Inconsistency | HIGH | `spec.md:310-311`; `tasks.md:194`; `contracts/messages.md:62-64` | T012 copies configured options into `/trace`, while pi can reduce `maxTokens` to fit available context. With cap 0, pi still supplies its model/context ceiling, although the contract says "no output limit." | Define whether trace reports configured app settings or the effective provider payload; align implementation and wording. |
| U1 | Underspecification | HIGH | `spec.md:260-261`; `research.md:130-140`; `tasks.md:153-158` | The external-edit edge case promises "nothing to bring back," but the planned algorithm retains the reply in memory and checks the in-memory leaf. It defines no way to detect a removed file entry or edited session file. | Specify how external changes invalidate `/prev`, and add verification. |
| I5 | Inconsistency | MEDIUM | `spec.md:298-300`; `tasks.md:177` | The spec checks whether a persona is active; T011 checks whether a persona filename is configured. A missing or invalid persona file suppresses the prompt even though no persona is active. | Use resolved persona availability, or explicitly define the configured-file behavior. |
| C3 | Coverage | MEDIUM | `spec.md:303-304`; `tasks.md:159,208-215` | FR-014 requires help, README, and the command contract to describe all four additions. Tasks cover all four only in README; help and the command contract receive `/prev` alone. | Add the missing documentation work or narrow FR-014. |

The pi behavior behind I4 was verified in
`../pi/packages/ai/src/api/simple-options.ts:36-46`: `buildBaseOptions` supplies a model default
and clamps the output limit against available context. The OpenAI completions adapter invokes
it at `../pi/packages/ai/src/api/openai-completions.ts:738-756`.

## Coverage Summary

"Has task" means at least one related task exists; it does not mean coverage is complete.

| Requirement | Has task? | Task IDs | Notes |
|---|---|---|---|
| FR-001 | Yes | T005 | Preserves manual retry behavior |
| FR-002 | Yes | T005 | Partial text and marker |
| FR-003 | Yes | T005 | Contract conflict: I3 |
| FR-004 | Yes | T005 | Structured, redacted failure log |
| FR-005 | Yes | T001, T002, T004 | Settings and request cap |
| FR-006 | Yes | T007 | Guarantee conflict: I1 |
| FR-007 | Yes | T002, T008 | Length outcome and notice |
| FR-008 | Yes | T008 | Unknown-price notice |
| FR-009 | Yes | T006 | Reminder visibility |
| FR-010 | Yes | T009, T010 | Conflicts/gaps: I2, U1 |
| FR-011 | Yes | T009, T013 | Persistence and next request |
| FR-012 | Yes | T011 | Persona condition: I5 |
| FR-013 | Yes | T003, T011, T013 | Name resolution |
| FR-014 | Partial | T010, T014 | Missing documentation coverage: C3 |
| FR-015 | Yes | T001, T002, T004 | Sampling validation and transport |
| FR-016 | Yes | T001, T004 | Startup warnings |
| FR-017 | Yes | T012 | Trace semantics: I4 |
| SC-001 | Yes | T005 | Failure guidance |
| SC-002 | Yes | T002, T004, T007 | Cannot satisfy literal spending guarantee |
| SC-003 | Yes | T009, T010, T013 | Depends on resolving I2 |
| SC-004 | Yes | T003, T011, T013, T015 | Traveler fallback |
| SC-005 | Yes | T005 | Diagnostic log fields |
| SC-006 | Yes | T004, T012, T014 | Temperature and trace |

## Constitution Alignment Issues

- C1 conflicts with the Language rule (`.specify/memory/constitution.md:116-120`).
- C2 leaves mandated edge-case verification unplanned
  (`.specify/memory/constitution.md:139-146`).

## Unmapped Tasks

None. T015-T017 cover validation, convergence, and reporting.

## Metrics

- Requirements: **23** (17 functional requirements and 6 verifiable success criteria).
- Tasks: **17**.
- Coverage with at least one related task: **100%**, including partial coverage.
- Findings: **9** (2 CRITICAL, 5 HIGH, 2 MEDIUM).
- Ambiguity findings: **0**.
- Duplication findings: **0**.
- Critical findings: **2**.

## Next Actions

Have the design owner reconcile the findings, update the affected tasks with `$speckit-tasks`,
and rerun `$speckit-analyze` before `$speckit-implement`. No remediation edits have been applied.

The subsequent convergence prerequisite check found all 17 tasks unchecked and the expected
feature implementation symbols absent. The convergence skill requires an implementation pass
first; no convergence tasks were appended.

No extension hooks were configured. Tests were not run for this documentation analysis.

## Development Tool and Token Usage

The conversation retains each tool invocation, its command or arguments, and its outcome.
The analysis used 24 `exec_command` invocations in 10 `functions.exec` calls:

| Shell invocation(s) | Purpose | Outcome |
|---|---|---|
| 1-2 | Read the analyze skill and locate repository guidance/hooks | Skill read; no nested guidance or hook configuration found by the search |
| 3-5 | Check pre-hooks, initialize prerequisites, read constitution and repository instructions | Feature resolved; constitution and instructions loaded; no hooks configured |
| 6-9 | Read the core artifacts and identify the active feature context | Spec, plan, tasks, and feature document inventory loaded |
| 10-11 | Read remaining requirements, plan details, data model, and message contract | Requirement and contract comparisons completed |
| 12-14 | Read research, quickstart, prior report, source locations, and pinned dependencies | Supporting decisions and implementation scope identified |
| 15-17 | Inspect app/engine behavior, pi source, existing tests, and constitution references | Evidence collected; combined output was partly truncated and relevant details were followed up |
| 18-19 | Verify pi option normalization, session storage, settings, and error handling | Default/clamped token behavior confirmed; guessed persona filename was absent |
| 20-21 | Inspect retry references, usage behavior, persona handling, and existing tests | Relevant behavior inspected; missing guessed paths and an unmatched shell glob were reported |
| 22-23 | Verify pi retry defaults, persona resolution, and final hook/workspace state | No automatic provider retries by default; persona fallback confirmed; no hooks configured |
| 24 | Check requirement/task counts, existing test coverage, and final workspace state | Counts and coverage gaps confirmed; no tracked changes at analysis completion |

The convergence prerequisite check used three further `exec_command` invocations in one
`functions.exec` call: read the converge skill and check hooks (successful), resolve prerequisites
(successful), and inspect task state plus implementation symbols (implementation prerequisite
not met).

Saving this report used `exec_command` to check the destination and requirement/task identifiers,
`apply_patch` to create `analysis.md`, and `exec_command` to verify the saved report. These calls
are also recorded in the conversation.

Total platform-reported development token usage: **unknown**. No estimate is substituted.
No `.env` or real user home/settings were read or used.
