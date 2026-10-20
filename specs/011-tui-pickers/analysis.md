# Specification Analysis Report

**Feature**: `011-tui-pickers`  
**Date**: 2026-10-20  
**Reviewed against**: constitution 3.2.0 and the local pi `v1.3.0` reference source.

**Result**: Resolve one CRITICAL and two HIGH findings before implementation. This report records
the read-only analysis; no remediation has been applied to the feature artifacts or code.

Locations below are relative to `specs/011-tui-pickers/` unless otherwise stated.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|---|
| C1 | Constitution alignment | CRITICAL | spec.md:195–202; plan.md:99–104; tasks.md:126–152 | The constitution requires testing listed edge cases. Planned tests omit importing an already-imported lorebook, `/new` after resuming a chat, and damaged-item `/show` behavior. These are not recorded as deferred. | Add explicit test coverage, identifying any inherited tests. Assess complexity and explicitly defer tests where warranted. |
| I1 | Inconsistency | HIGH | spec.md:202; tasks.md:92 | The damaged-item requirement cannot be reached through the planned picker: `listLibrary()` silently excludes unreadable or malformed items. Shell `show` reports “Item not found,” while the picker cannot select the item. | Clarify the intended damaged-item interaction, then align the plan and task. Preserve FR-010's unchanged shell behavior. |
| I2 | Inconsistency | HIGH | spec.md:203; research.md:26–35,52; tasks.md:164–171 | Long titles must be truncated, but the plan reuses `ListPicker` unchanged. Its title uses pi's wrapping `Text` component. Truncating rendered child lines cannot undo that wrapping. | Plan title truncation before wrapping occurs, and include a long-title check. |
| G1 | Coverage gap | MEDIUM | plan.md:17; research.md:134–139; tasks.md:66 | T001 changes CI triggers, but no feature requirement or user story covers this behavior. | Add an explicit owner-approved scope requirement or move the CI change to separate work. |
| U1 | Underspecification | MEDIUM | spec.md:232–233,258–259; tasks.md:185 | T014 says old contract rows should note “changed by 011,” without explicitly removing obsolete commands from its active command table. Its verification command also excludes contracts. | Specify the final active rows and verify contracts as well as source and README, allowing clearly historical descriptions. |

## Source Evidence

- **C1**: `.specify/memory/constitution.md:139–146` requires tests for listed edge cases and
  permits explicit complexity-based deferral. The missing cases are listed in `spec.md:195–202`
  but are absent from the explicit test descriptions in `plan.md:99–104`.
- **I1**: `packages/data/src/library.ts:129–160` skips unreadable or malformed library items.
  `getItem()` at lines 163–169 searches that filtered list.
  `packages/tui/src/cli.ts:89–104` reports `Item not found: <id>` when lookup fails. T005 builds
  its picker directly from `listLibrary(paths)`, so these items have no selectable entry.
- **I2**: `packages/tui/src/components/list-picker.ts:75–78` renders the title through
  `new Text(this.title).render(width)`. In the pinned reference clone,
  `../pi/packages/tui/src/components/text.ts:68–73` wraps text before returning rendered lines.
  The proposed frame only truncates those already-rendered lines.
- **G1**: Research R7 explains the CI change, and the plan and T001 include it, but the spec's
  requirements, user stories and success criteria do not establish that scope.
- **U1**: `specs/006-usability/contracts/commands.md:6–25` currently lists the obsolete commands
  under “Commands (suggested and listed by `/help`)”. Merely annotating those rows leaves the
  active command table unclear. T014's verification searches only `packages/tui/src` and
  `README.md`.

## Coverage Summary

Coverage means an associated task exists; it does not establish complete acceptance coverage.

| Requirement Key | Has Task? | Task IDs | Notes |
|---|---|---|---|
| FR-001 | Yes | T005 | Damaged-item conflict: I1 |
| FR-002 | Yes | T008, T010 | Removal and unknown-command checks |
| FR-003 | Yes | T002, T006 | Picker entries and states |
| FR-004 | Yes | T006, T008 | Toggle and embedded-book behavior |
| FR-005 | Yes | T004, T007, T008 | Missing edge test: C1 |
| FR-006 | Yes | T008, T011 | Persistence and next-request use |
| FR-007 | Yes | T003, T009–T011 | Missing resumed-chat check: C1 |
| FR-008 | Yes | T012, T013, T017 | Title conflict: I2; owner visual checks |
| FR-009 | Yes | T005, T008, T010, T014 | Contract verification gap: U1 |
| FR-010 | Yes | T015 | Existing regression suite |
| SC-001 | Yes | T005–T010 | Actions available without typed ids |
| SC-002 | Yes | T007, T008 | Import-and-attach flow |
| SC-003 | Yes | T009–T011 | Fresh session and preserved previous chat |
| SC-004 | Yes | T012, T013, T017 | Automated frame checks and owner review |
| SC-005 | Yes | T014 | Verification scope needs clarification |

## Constitution Alignment Issues

C1 conflicts with the constitution's testing policy. Add explicit coverage for the listed edge
cases, reference existing tests where they already cover the required interaction, or record
complexity-based deferrals as the constitution permits. Resolve I1's behavior before specifying
its test.

## Unmapped Tasks

- T001 has no spec requirement or user story.
- T015–T017 support validation, convergence and reporting.

## Metrics

- Total requirements: **15** (10 functional requirements and 5 buildable success criteria).
- Total tasks: **17**.
- Requirement-level task coverage: **100%**.
- Findings: **5** (1 CRITICAL, 2 HIGH, 2 MEDIUM).
- Ambiguity findings: **0**.
- Duplication findings: **0**.
- Critical issues: **1**.

## Next Actions

1. Resolve C1, I1 and I2 before `$speckit-implement`.
2. Have the design owner refine the damaged-item behavior and title-rendering plan.
3. Update task coverage and contract verification, and resolve the CI scope discrepancy.
4. Rerun `$speckit-analyze` after the artifacts are updated.

No remediation is authorized by this report. Concrete remediation edits can be proposed in a
follow-up review.

## Development Usage

The original analysis used 9 `functions.exec` orchestration calls and 22 `exec_command` shell
invocations. Their commands and outcomes are preserved in the conversation's tool transcript.
The calls read the skill, repository state, prerequisites, constitution, feature artifacts and
supporting source, and verified the local pi tag. One read used an incorrect trace component
filename; the subsequent source inspection read the correct file. No tests were run and the
working tree was clean at the end of the analysis.

Saving this report was explicitly requested by the owner after the read-only analysis. The save
workflow records these additional invocations:

| Tool | Purpose | Outcome |
|---|---|---|
| `functions.exec` / `exec_command` | Check branch, working tree and whether an existing `analysis.md` needs preservation | Branch `011-tui-pickers`; clean working tree; no existing report |
| `functions.exec` / `apply_patch` | Write this analysis report | Created `specs/011-tui-pickers/analysis.md` |
| `functions.exec` / `exec_command` | Verify the saved report and working tree | See the verification result in the tool transcript |

Total development token usage: **unknown**. Platform-reported usage was unavailable; no estimate
is substituted.
