# Specification Analysis Report: UI Polish

**Date**: 2026-10-20
**Feature**: `009-ui-polish`
**Scope**: Cross-artifact analysis before implementation, using `speckit-analyze`.
**Reviewed**: `spec.md`, `plan.md`, `tasks.md`, supporting research and quickstart,
constitution 3.1.0, and relevant pi source at the pinned `v1.3.0` tag.

## Handoff for the design agent

The analysis found **1 HIGH and 5 MEDIUM issues**. Every functional requirement and success
criterion has an associated task. No direct constitution conflicts were identified.
Resolve I1 before implementation, then refine the remaining design and validation details.

This report records findings and recommendations; it does not introduce approved design
decisions. No spec, plan, research, quickstart or task changes were made during analysis.
The owner subsequently requested this report as a document for Claude to read.

## Findings

Line references below refer to the artifacts as reviewed on 2026-10-20.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | HIGH | research.md:11-12; tasks.md:63 | Copy-on-select relies on `getNativeClipboard()`, but its Linux API explicitly leaves clipboard writes to command-line tools. `setText` is optional. The selected mechanism does not establish a working Linux copy path. | Choose and document a supported copy path, such as pi's built-in OSC 52 mechanism, including its availability limits. |
| U1 | Underspecification | MEDIUM | spec.md:287-288; plan.md:76; research.md:40 | The spec assigns exact colours to the plan, but the plan and research define style names without a palette. | Specify the dark-background palette for each named style. Keep the light palette explicitly conditional. |
| A1 | Ambiguity | MEDIUM | tasks.md:52; spec.md:237-238 | T001 permits making every style return unchanged text under `NO_COLOR`, potentially removing the italics required by FR-005. | Decide whether `NO_COLOR` removes colours only or also text attributes, then align the requirement and task. |
| C1 | Coverage | MEDIUM | spec.md:213-214; plan.md:85-98; tasks.md:118 | The tiny-terminal edge case has no explicit validation. Testing the narrow logo fallback does not check whether the complete layout remains usable below 40 columns or 10 rows. | Add a concrete owner check for both dimensions, with an automated check only if lightweight. |
| I2 | Inconsistency | MEDIUM | plan.md:97; tasks.md:52,74-99 | T-i checks rendered labels, bars and `Error:`, but T001 schedules it as style tests before those components exist. Later tasks do not explicitly complete that rendered check. | Split theme tests from rendered `NO_COLOR` checks; schedule the latter after message and status integration. |
| I3 | Inconsistency | MEDIUM | quickstart.md:7; tasks.md:116 | Quickstart omits `--repo "$PWD"`. The acceptance script defaults to sibling `LittleTavern`, so it can validate a different checkout. | Use the explicit checkout argument consistently. |

### Source evidence for I1

These paths are relative to the repository root:

- `../pi/packages/tui/src/native-platform.ts:9-17`: `NativeClipboard.setText` is optional;
  its comment says Linux uses command-line tools to retain clipboard ownership.
- `../pi/packages/tui/src/native-platform.ts:61-64`: the Linux native helper requires `DISPLAY`
  and loads the X11 helper.
- `../pi/packages/tui/src/tui-alt-screen.ts:191-199`: omitting `copySelection` uses OSC 52;
  a supplied callback returns success or a visible error.
- `../pi/packages/coding-agent/src/utils/clipboard.ts:86-149`: pi coding-agent's copy utility
  uses platform commands and conditional OSC 52; it does not use the native Linux helper
  as a clipboard writer.

The existing research already describes a visible error when native copying is unavailable.
The unresolved point is whether the deliberately limited availability satisfies the intended
copy-on-release behaviour, and which supported write mechanism the implementation should use.
The design agent should settle that choice; this report does not select a fallback policy.

## Coverage Summary

Coverage means an associated task exists. It does not establish implementation correctness
or complete validation coverage.

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 | Yes | T004, T015 | Full screen and terminal restoration |
| FR-002 | Yes | T003, T004, T015 | Clipboard mechanism needs clarification/correction |
| FR-003 | Yes | T005 | Logo and fallback |
| FR-004 | Yes | T001, T006, T007 | Labels, bars and spacing |
| FR-005 | Yes | T002, T007 | Resolve `NO_COLOR` attribute behaviour |
| FR-006 | Yes | T001, T007 | Error styling |
| FR-007 | Yes | T008 | Waiting lifecycle |
| FR-008 | Yes | T009 | Placeholders |
| FR-009 | Yes | T010 | Key and model flow |
| FR-010 | Yes | T001 | Rendered validation needs later scheduling |
| SC-001 | Yes | T006, T007, T015 | Rendering plus owner inspection |
| SC-002 | Yes | T004, T005, T015 | Full-screen home |
| SC-003 | Yes | T008 | Delayed simulated reply |
| SC-004 | Yes | T013 | Regression and acceptance checks |

## Constitution Alignment

No direct conflicts identified. The palette omission weakens the plan's self-sufficiency
(Development Workflow). Tiny-terminal verification should be included under the edge-case
testing policy.

The reference clone was read without modifications. No secrets, real provider calls, local
models or GPU work were used. The active branch was `009-ui-polish`; the ancestry check
against `008-persona` passed.

## Unmapped Tasks

None. T011-T012 map to User Story 7; T013-T015 cover validation, convergence and reporting.

## Metrics

- Total requirements: **14** (10 functional requirements and 4 success criteria).
- Total tasks: **15**.
- Requirement coverage: **100%**.
- Findings: **6** (1 HIGH, 5 MEDIUM).
- Ambiguity count: **1**.
- Duplication count: **0**.
- Critical issues: **0**.

## Recommended Next Actions

1. Resolve I1 before `speckit-implement`.
2. Have the design agent specify the palette and `NO_COLOR` attribute rules.
3. Update task scheduling for rendered colour-disabled checks, include tiny-terminal
   validation, and correct the quickstart checkout argument.
4. Rerun `speckit-analyze` after the artifact changes.

No remediation edits have been applied. Build, lint, automated tests and acceptance checks
were not run: this was an artifact analysis, followed by saving this report.

## Development Tool and Token Usage

Platform-reported total development token usage: **unknown**. The platform exposes no run
total here; no estimate or zero is substituted.

The analysis used 7 `functions.exec` batches containing the following 15 `exec_command`
invocations, in order. Each completed successfully; detailed commands and results remain
in the session transcript.

| Invocation | Purpose | Outcome |
|------------|---------|---------|
| 1 | Inspect working directory, Git status and analysis skill location | Correct repository; clean worktree; skill found |
| 2 | Read the skill, repository instructions and any extension configuration | Instructions loaded; no extension configuration present |
| 3 | Run the required prerequisite script once | Feature directory resolved; required artifacts present |
| 4 | Read the constitution with line numbers | Constitution 3.1.0 loaded |
| 5 | Read the specification | Requirements, scenarios and edge cases loaded |
| 6 | Read the implementation plan | Architecture, constraints and test plan loaded |
| 7 | Read tasks and identify the current branch and supporting artifacts | 15 tasks; branch `009-ui-polish` |
| 8 | Read research, quickstart and requirements checklist | Supporting decisions and validation guidance loaded |
| 9 | Locate relevant source, inspect package versions, check ancestry and pi tag | `008-persona` ancestry passed; pi pinned and checked out at `v1.3.0` |
| 10 | Inspect pi full-screen setup and application integration points | Full-screen API assumptions checked |
| 11 | Inspect Markdown, theme, editor, picker, status and acceptance runner | Rendering and validation assumptions checked |
| 12 | Inspect stream lifecycle, key prompt, settings, loader and clipboard API | Lifecycle and clipboard constraints checked |
| 13 | Inspect Markdown rendering, external-editor integration, layout and existing test/report patterns | Implementation context checked |
| 14 | Inspect application setup, clipboard implementation and existing key-flow tests | Linux clipboard mismatch confirmed |
| 15 | Cross-check artifact wording, extension configuration and final Git status | Findings corroborated; no extensions; clean worktree |

Saving this handoff adds a context-read invocation, a patch invocation to create this file,
and a verification invocation. Their commands, purposes and final outcomes are recorded in
the accompanying session transcript. The context read found no existing analysis or usage
document; its final file search exited 1 because there were no nested `AGENTS.md` matches.
