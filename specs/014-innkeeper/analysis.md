# Specification Analysis Report: The Innkeeper

**Date**: 2026-10-20  
**Feature**: `014-innkeeper`  
**Constitution**: 3.2.0  
**Scope**: Cross-artifact analysis before implementation. Supporting design documents and
relevant local source were consulted. No implementation or design artifacts were changed.

Five findings remain, including one critical constitution conflict. Resolve the critical
issue before running `speckit-implement`.

## Findings

Locations refer to the artifacts as read during this analysis.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|---|
| C1 | Constitution | CRITICAL | data-model.md:61–62; tasks.md:102; plan.md:58; constitution.md:29–30 | `ChatSessionOptions.tools` and exported `createInnkeeperTools()` expose pi's `AgentTool[]`. Principle II requires public engine APIs to expose only LittleTavern types. The plan incorrectly marks this boundary as passing. | Define a LittleTavern-owned public interface and keep pi tool types inside the adapter. Update the Constitution Check. |
| U1 | Underspecification | HIGH | data-model.md:52–58; tasks.md:124–135; contracts/messages.md:50 | T006 must display the backup path, but `applied(changes)` receives only changes. `updateSettings()` returns the path inside the engine tool; no defined callback carries it to the app. | Specify how the successful save result, including `backupPath`, reaches the app. |
| I1 | Inconsistency | HIGH | research.md:93, 138–143; data-model.md:52–58 | `read_settings` promises effective limits, but its context has no access to the app's active request settings. After a hand edit, file values can differ from the values actually used until restart. | Define saved versus active values in the result and provide access to the active snapshot where needed. |
| I2 | Inconsistency | HIGH | spec.md:202–204; research.md:132–143 | The edge case says preserved hand edits apply only after restart. R7 retains per-request lore reads, so hand-edited lore values apply immediately. Existing `packages/engine/src/character-chat.ts:63–79` confirms this behavior. | Clarify whether the restart statement covers only cached settings or also lore settings; align the implementation instructions. |
| E1 | Coverage | MEDIUM | spec.md:259–260; tasks.md:103–108, 173; contracts/messages.md:77–81 | FR-014 requires help and README coverage of confirmations, backups, and `toolRounds`. Tasks cover the README, command description, and paths, but do not add those explanations to help. | Add explicit help-text work and verification to T004 or T011. |

## Coverage Summary

"Has Task?" means a related task exists; it does not establish complete coverage.
All five success criteria describe buildable, verifiable application behavior and are included
in the inventory.

| Requirement Key | Has Task? | Task IDs | Notes |
|---|---|---|---|
| FR-001 | Yes | T002, T004 | Conversation isolation and replay; T004 refers to the plan's app tests, including `/new`. |
| FR-002 | Yes | T003 | Innkeeper prompt. |
| FR-003 | Yes | T003, T004 | Read-only tools and help content; see I1. |
| FR-004 | Yes | T003, T005 | Secret exclusion and allowed settings. |
| FR-005 | Yes | T001, T005 | Validation and removal. |
| FR-006 | Yes | T005, T006 | Confirmation. |
| FR-007 | Yes | T001, T005 | Backup creation. |
| FR-008 | Yes | T002, T006 | Live request changes; lore relies on existing per-request reads. See I2. |
| FR-009 | Yes | T007, T008 | New and resumed chats. |
| FR-010 | Yes | T003, T005 | Command guidance and restrictions. |
| FR-011 | Yes | T001, T002, T009 | Round limit and notice. |
| FR-012 | Yes | T002, T009 | Summed usage. |
| FR-013 | Yes | T002, T004 | Tool lines. |
| FR-014 | Partial | T004, T011 | README covered; help explanations incomplete. See E1. |
| SC-001 | Yes | T003, T004, T010 | Help workflow. |
| SC-002 | Yes | T005, T006, T010 | Confirmed live changes. |
| SC-003 | Yes | T001, T005, T006, T010 | Confirmation and backups. |
| SC-004 | Yes | T002, T009 | Rounds and cost. |
| SC-005 | Yes | T003 | Secret-exclusion tests. |

## Constitution Alignment Issues

C1 violates Principle II, "Wrap pi Behind Our Own Types." The proposed public API exposes a
pi type, despite the plan marking the principle as passing. No exception is recorded. Resolve
the design conflict without weakening or reinterpreting the constitution.

## Unmapped Tasks

T012–T014 are validation, convergence, and reporting tasks justified by the development
workflow. No unrelated implementation task was identified.

## Metrics

- Total requirements: **19** (14 functional requirements and 5 success criteria).
- Total tasks: **14**.
- Coverage: **100% have at least one associated task**, with partial coverage noted above.
- Ambiguity findings: **0**.
- Duplication findings: **0**.
- Underspecification findings: **1**.
- Inconsistency findings: **2**.
- Critical issues: **1**.

## Next Actions for the Design Owner

1. Resolve C1 before `speckit-implement`: update the public tool interface and the plan's
   Constitution Check.
2. Define the save-result callback for U1, including the backup path needed by the app notice.
3. Settle I1 and I2: distinguish active and saved settings, and state which hand edits need a
   restart.
4. Add explicit help-text coverage to T004 or T011 for E1.
5. Rerun `speckit-analyze` after the artifacts are updated.

These are recommendations only. No remediation has been applied. The owner requested that
this report be saved as `analysis.md` for Claude to review.

## Verification and Development Usage

- Verified the relevant pi APIs against the read-only `../pi` reference clone at tag
  `v1.3.0`, including sequential execution, `finishTurn`, tool schemas, and catalog filtering.
- No `.specify/extensions.yml` existed when checking pre-analysis and post-analysis hooks.
- No tests were run: this was an artifact analysis, followed by saving this report.
- No `.env`, real application settings, real provider, local LLM, or GPU was used.
- Platform-reported total development token usage: **unknown**. No estimate is substituted.
- The original analysis used **8 `functions.exec` invocations**, orchestrating **12 read-only
  `exec_command` invocations**. Their purposes and outcomes are recorded below. The individual
  tool calls and the later report-persistence calls are also recorded in the conversation.

| Shell invocation | Purpose | Outcome |
|---|---|---|
| 1 | Read the analysis skill and check extension configuration. | Skill read; no extension configuration present. |
| 2 | Run the required prerequisite check. | Resolved `specs/014-innkeeper`; required artifacts available. |
| 3 | Read repository instructions and constitution; inspect branch and working tree. | Branch `014-innkeeper`; working tree clean. |
| 4 | Read the core feature artifacts. | Read completed; combined output was truncated and relevant sections were read separately. |
| 5 | Read plan, data model, and message contract. | Completed. |
| 6 | Read research, quickstart, and current settings implementation. | Completed. |
| 7 | Inspect current session, character assembly, app request wiring, and engine package metadata. | Completed. |
| 8 | Verify pi tag and APIs; inspect the previous report and placeholder search. | Completed; reference tag `v1.3.0` confirmed. |
| 9 | Inspect engine exports, usage accounting, spend handling, and settings references. | Completed. |
| 10 | Locate pi tool execution and inspect help references; check extension configuration. | Guessed `tool-execution.ts` path did not exist; search located the implementation in `agent-loop.ts`. No extension configuration present. |
| 11 | Read the actual pi execution code, help text, and model filter; recheck working tree and hooks. | Completed; working tree clean and no extension configuration present. |
| 12 | Count explicit FR, SC, and task identifiers. | Confirmed 14 FRs, 5 SCs, and 14 tasks. |
