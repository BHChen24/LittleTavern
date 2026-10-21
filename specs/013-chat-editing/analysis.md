# Specification Analysis Report

**Feature**: `013-chat-editing`  
**Date**: 2026-10-20  
**Audience**: Claude and the project owner

Reviewed `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`,
`contracts/messages.md`, `quickstart.md`, the constitution (3.2.0), and relevant existing
engine/TUI code. Verified the relevant pi behavior against `../pi` at tag `v1.3.0`, matching
the exact package pins.

This is a pre-implementation artifact review. All 13 tasks are unchecked. The requested
report is the only file created; no specification, plan, task, application code or reference
tree was changed. Locations in the findings table are relative to this feature directory.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|---|
| C1 | Constitution / coverage | CRITICAL | `spec.md:154-165`; `plan.md:95-103`; `tasks.md:111-127,149` | Several listed edge cases have no explicit planned test or complexity-based deferral: quitting during an edit; preserving paid usage after undo/edit; retaining the last trace after undo/character edit; regenerating an edited character reply and restoring it with `/prev`; and Ctrl+R retry after a failed edited-player send. The constitution requires testing listed edge cases or recording assessed deferrals. | Add these cases to the test plan and task descriptions, or explicitly assess and defer cases that are too complex. Existing tests of the earlier features do not exercise their interaction with the new operations. |
| I1 | Inconsistency | HIGH | `research.md:21-23,36-41`; `data-model.md:10`; `tasks.md:80-87` | The undo algorithm assumes the entry before the first player message is a greeting or the root character entry. `CharacterChat.start()` also appends a `session_info` entry. On a card without a greeting, that is the first player message's parent, but T002 defines copying only `message` and `custom` entries. Its required no-greeting test cannot follow the prescribed algorithm as written. | Correct R1/R2 and define how undo handles `session_info`; update the data model and T002 together. Include undoing the first turn without a greeting, reopening, and sending again in the test. |
| I2 | Inconsistency | HIGH | `spec.md:150,156-157,184-186,197`; `tasks.md:121`; `data-model.md:54,57` | FR-005 says saving an edit drops every later message, but the unchanged-character edge case and T007 leave the entire chat unchanged. The same no-op path skips clearing `/prev` and removing an interrupted mark, despite the general saved-edit requirements. The unchanged case needs an explicit boundary around those rules. | State whether an unchanged character submission counts as a saved edit. Explicitly reconcile later messages, the interrupted mark and the previous-reply slot; align FR-005/FR-011, edge cases, state transitions and tests. |
| I3 | Inconsistency | HIGH | `spec.md:39-41,113-114,152-153,182-187`; `research.md:87-88,101-104`; `plan.md:101`; `tasks.md:123-125`; `contracts/messages.md:39-42` | The spec promises Enter saves the typed text and Esc cancels the edit. The plan instead lets Esc close autocomplete while remaining in editing state. Autocomplete also remains enabled: pi applies a selected slash completion before submitting on Enter, so a typed prefix such as `/un` can become `/undo` before the proposed `submit()` edit handler receives it. Bypassing command dispatch alone does not preserve the entered text. | Decide and document autocomplete behavior during editing. Make the spec, banner/contract, research and tasks agree; test through actual editor input with the menu open, including a slash prefix, rather than only calling `submit()` directly. |
| G1 | Coverage | MEDIUM | `spec.md:189-193,215-217`; `plan.md:96-102`; `tasks.md:87,111,149` | Planned persistence tests compare the active history after reopening, but do not explicitly assert that all original saved entries remain after undo and both kinds of edit (FR-008/SC-004). The character-edit tests also stop short of inspecting the next request to prove it contains the edited reply and excludes dropped messages (FR-009/SC-003). | Add assertions that pre-operation session records remain intact after each operation, and capture a subsequent faux-provider request after a character edit. These are tests of our branch/history behavior, not tests of pi's storage implementation. |

### Evidence for the implementation conflicts

- **I1:** `packages/engine/src/character-chat.ts:200-206` creates the chain
  `character custom entry → session_info → optional greeting`. Pi's
  `../pi/packages/coding-agent/src/core/session-manager.ts:1303-1314` creates a distinct
  `session_info` entry type with `name`, not `customType`/`data`. The no-greeting branch
  therefore does not fit either copy operation in T002. The broader invariant should also
  allow a non-message leaf when no visible messages remain.
- **I2:** With three turns, select reply 1 and press Enter unchanged. T007 keeps turns 2 and 3;
  literal FR-005 drops them. Selecting an interrupted reply unchanged follows the same no-op
  path and retains its interrupted marker. After a regenerate, this path also leaves
  `replaced` populated because it never calls `editReply()`. These are unresolved exceptions,
  not authorization for the implementer to choose behavior.
- **I3:** The app installs `CombinedAutocompleteProvider` in
  `packages/tui/src/app.ts:241`. Pi handles autocomplete before submission in
  `../pi/packages/tui/src/components/editor.ts:757-815`: Esc closes the menu; Enter applies
  the selection and then submits for slash completions. Its default confirm binding is
  Enter (`../pi/packages/tui/src/keybindings.ts:154`). The proposed edit interception happens
  after those transformations. Loading text with `setText()` closes an existing menu, but
  typing can open another one, as R4 itself observes.

No significant duplicate requirements or unresolved placeholder tokens were found. The
existing Ctrl+O behavior is explicitly discussed in the plan; it is not treated as an
additional finding about introducing a new external-editor flow.

## Coverage Summary

“Has task” means at least one task addresses the requirement. It does not mean the task is
consistent with every acceptance condition or verifies all of it. All four success criteria
describe verifiable feature behavior; none is a post-launch business metric.

| Requirement Key | Has Task? | Task IDs | Notes |
|---|---|---|---|
| FR-001 | Yes | T002, T003 | Undo and input restoration; no-greeting algorithm gap: I1 |
| FR-002 | Yes | T002, T003 | Greeting protection and nothing-to-undo behavior |
| FR-003 | Yes | T001, T006, T007 | IDs, searchable picker, ordering and empty state |
| FR-004 | Yes | T005, T006, T007 | Full input text and visible editing banner; key behavior: I3 |
| FR-005 | Yes | T004, T007 | Player resend, character save, spend check; unchanged exception: I2 |
| FR-006 | Yes | T007 | Cancel and input clearing; autocomplete exception: I3 |
| FR-007 | Yes | T007 | Empty input refused while editing continues |
| FR-008 | Yes | T002, T004 | Append/branch design preserves records; explicit verification gap: G1 |
| FR-009 | Yes | T002, T003, T004, T007, T009 | History, transcript and restart agreement; G1 |
| FR-010 | Yes | T003, T006, T008 | Chat-only and streaming guards |
| FR-011 | Yes | T002, T004, T008 | Clear `/prev`; unchanged-character scope: I2 |
| FR-012 | Yes | T003, T006, T010 | Help, README and shared command contract |
| SC-001 | Yes | T002, T003, T009 | Undo, fix and resend without a new chat |
| SC-002 | Yes | T004, T006, T007, T009, T013 | Edit earlier messages; timing/look remain owner validation |
| SC-003 | Yes | T002, T004, T007, T009 | Observable/request/resume agreement; G1 |
| SC-004 | Yes | T002, T004 | Non-deletion design present; verification gap: G1 |

## Constitution Alignment Issues

**C1** conflicts with the Development Workflow testing policy at
`.specify/memory/constitution.md:139-146`: “Edge cases are tested when the feature spec lists
them.” The plan's test table currently marks only its listed tests as write/manual; it does
not assess or defer the omitted cases. Add coverage or documented complexity-based deferrals
before implementation. Do not weaken the constitution to resolve this finding.

No additional constitution conflict was identified. The plan keeps context policy in our
engine, uses pi's session storage and editor, preserves package direction, adds no dependency,
and includes the required development usage accounting and build/lint/test gates.

## Unmapped Tasks

None. T001–T010 implement or verify the stories and their documentation. T011–T013 provide
feature validation, convergence and reporting. Dependencies put engine work before the TUI
integration; no material task-order contradiction was found.

## Metrics

- Total requirements: **16** (12 FRs and 4 verifiable SCs).
- Total tasks: **13**, all unchecked.
- Requirements with at least one associated task: **16/16 (100%)**; coverage is partial where
  findings identify conflicts or missing assertions.
- Findings: **5** (**1 CRITICAL**, **3 HIGH**, **1 MEDIUM**).
- Ambiguity-category findings: **0**; unresolved behavioral exceptions are grouped under I2/I3.
- Duplication findings: **0**.
- Critical issues: **1**.

## Next Actions for Claude

1. Resolve C1 before `$speckit-implement`: extend the test plan and tasks or document assessed
   complexity-based deferrals for the listed cases.
2. Reconcile I1–I3 in the owning artifacts. I1 needs a corrected storage algorithm; I2 and I3
   need explicit behavioral decisions reflected in the spec and its supporting documents.
3. Add G1's focused assertions to the engine/app test tasks.
4. Refresh affected tasks with `$speckit-tasks` if needed, then rerun `$speckit-analyze` before
   `$speckit-implement`.

No remediation edits have been applied. Optional follow-up: would you like concrete
remediation edits proposed for the top four issues?

No extension hooks were configured. Build/lint/tests were not run for this analysis-only
documentation change. No `.env`, real user settings, real provider or local LLM was used.

## Development Tool and Token Usage

Each tool invocation and its result is retained in the conversation. This run uses
`functions.exec` to orchestrate the following tool calls; it does not invoke sub-agents.

| Invocation | Tool | Purpose | Outcome |
|---|---|---|---|
| 1 | `exec_command` | Read the analyze skill; inspect branch, workspace and existing report paths | Skill loaded; branch `013-chat-editing`; initially clean workspace |
| 2 | `exec_command` | Check pre-hooks and run the prerequisite script once | No extension configuration; feature and required artifacts resolved |
| 3 | `exec_command` | Read constitution and locate feature files/repository guidance | Constitution 3.2.0 and feature inventory loaded |
| 4 | `exec_command` | Read numbered spec and plan | Core requirements and architecture loaded |
| 5 | `exec_command` | Read numbered tasks, data model and contract | Task inventory and interfaces loaded; combined output exceeded display budget |
| 6 | `exec_command` | Read AGENTS, research, quickstart and preceding feature's analysis format | Supporting context loaded; relevant truncated portions reread below |
| 7 | `exec_command` | Read tasks separately | All 13 tasks and dependencies inspected |
| 8 | `exec_command` | Read plan, data model and message contract separately | Complete test plan and state transitions inspected |
| 9 | `exec_command` | Inspect engine and storage research | Existing session operations inspected |
| 10 | `exec_command` | Inspect app flows, dependency pins and reference version | Exact pi 1.3.0 match confirmed; relevant source locations found |
| 11 | `exec_command` | Inspect pi submission, InputBox, existing tests and constitution test policy | Editor clearing/trimming and mandated edge-case testing confirmed |
| 12 | `exec_command` | Inspect pi persistence/branch/session-info code and app request/spend flows | Session-info omission and append/reload behavior verified |
| 13 | `exec_command` | Inspect editor autocomplete, setup interception, app state and existing tests | Relevant input paths found; output partly truncated |
| 14 | `exec_command` | Read precise autocomplete handling and enumerate FR/SC/task IDs; recheck hooks | Enter transforms slash completions; 16 requirements and 13 tasks identified; absent hook file yields shell exit 1 |
| 15 | `exec_command` | Confirm editor provider/default bindings, edge cases and implementation state | Findings corroborated; feature methods absent; workspace still clean |
| 16 | `apply_patch` | Create this requested report | Only `specs/013-chat-editing/analysis.md` added |
| 17 | `exec_command` | Verify report counts/diff/workspace and check post-hooks | Final report validation; no source-artifact edits intended |

Total platform-reported development token usage: **unknown**. Per-invocation token usage is
also unavailable; no estimate or zero is substituted. Tool output token-size metadata is
not a measurement of total development token consumption.
