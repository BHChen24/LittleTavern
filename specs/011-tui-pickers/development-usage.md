# Development Usage: Pickers Instead of Ids

Total development token usage: **unknown**. The platform does not expose a run total to this
agent. No estimates are substituted.

Tool invocations are recorded below by phase. The conversation tool transcript preserves every
individual command, tool argument and returned outcome. Orchestration calls use `functions.exec`;
shell commands use `exec_command`, file patches use `apply_patch`, and running commands are polled
with `write_stdin` when needed. No secrets are included.

## Initialization and Phase 1

- `exec_command`: read the implementation skill, check extension hooks, branch and working tree,
  and run the prerequisite script. Passed; branch is `011-tui-pickers`, working tree was clean,
  and no extension hooks are installed.
- `exec_command`: scan checklists and read all feature artifacts and the constitution. The
  requirements checklist passed 16/16. Updated design resolves the previous analysis findings.
- `exec_command`: inspect source, test harnesses, dependencies, ignore patterns and git setup.
  Existing ignore patterns cover build output, dependencies, logs, environment files and editor
  artifacts. npm release contents use an explicit allowlist; no npmignore is needed.
- `apply_patch`: implement T001's CI trigger change and initialize this usage record. Passed.
- `exec_command`: validate the workflow's YAML trigger structure with the existing `yaml`
  dependency; run `pnpm build`, `pnpm lint` and `pnpm test`; commit the phase with normal hooks.
  Outcomes are recorded in the phase checkpoint and tool transcript.

Phase 1 checkpoint: T-j passed (`push.branches = [main]`, `pull_request` present).
`pnpm build`, `pnpm lint` (134 files) and `pnpm test` (61 files, 345 tests) passed.

## Phase 2: Foundational

- `exec_command`: inspected the pinned pi overlay, component and agent message APIs and release
  allowlist. Confirmed pi `v1.3.0`; no new dependency or ignore-file change is needed.
- `apply_patch` / `exec_command`: wrote unit tests before the two engine methods; the focused
  run failed as expected because those methods did not yet exist (3 failures, 18 passes).
- `exec_command`: implemented `attachedLorebookIds`, `clearConversation`, `showPanel` and the
  shared `importSelected` path; formatted the edited files and ran all required checks.
  The conversation reset follows the plan exactly: the next request contains only the new user
  message. Existing import validation and messages are preserved.
- `exec_command`: the first Phase 1 commit attempt failed because `.git` is read-only in the
  sandbox. The authorized escalated retry succeeded as `06b966d`, with gitleaks and lint hooks.
- `exec_command`: marked T002–T004 complete and committed this phase with normal hooks after
  the successful build, lint and test checkpoint.

## Phase 3: Show Picker

- `exec_command`: created synthetic app-harness tests for both item kinds, name filtering,
  selection/details, Esc cancellation, argument rejection and the empty-library hint. Updated
  command-completion expectations. The initial focused run failed as expected before implementation.
- `exec_command`: implemented T005 and formatted the edited files. Build and lint passed;
  all 62 test files and 352 tests passed. Inspected remaining command references and session APIs
  for the next phases.
- `exec_command`: marked T005 complete and committed the phase with normal hooks.

## Phase 4: Lorebook Picker

- `write_stdin`: confirmed the Phase 3 commit completed as `5bdec40`.
- `exec_command`: added T-d/T-e tests and updated existing command and character-app tests before
  implementation. The initial run failed as expected against the old listing and commands.
- `exec_command`: implemented import/card/library/missing entries, persistent toggles and the
  shared import-and-attach flow; removed attach/detach commands and completions.
- `exec_command`: build and lint passed. The first full suite exposed one test expectation using
  “too large” rather than the existing “larger than 20 MB” message; corrected the test without
  changing import behavior. All 62 test files and 362 tests then passed.
- `exec_command`: inspected remaining id-command tests, report structure and external offline
  acceptance script. Marked T006–T008 complete, recorded implementation details and committed
  the phase with normal hooks.

## Phase 5: New Chat and Removed Commands

- `exec_command`: read session-listing, app readiness and pinned pi persistence APIs; added
  T-f/T-g/T-h tests before implementation. The focused run failed as expected against the old
  commands and missing new handler.
- `exec_command`: implemented the explicitly planned new handler and streaming guard; removed
  chat, unused command-context/completion helpers and the creation hint suggesting an id.
  Existing app tests now select characters through the picker.
- `exec_command`: the first full run found that greeting-only sessions are not persisted by pi.
  Verified `_hasConversation`/`_persist` in pinned source and recorded behavior gap Q1 rather than
  inventing a storage change. Planned resumability tests use chats with user messages; both old
  and new chats are listed after the next exchange as the spec's independent test describes.
- `exec_command`: build, lint and all 62 test files / 376 tests passed. T010–T011 are complete;
  T009 remains unchecked because Q1 prevents satisfying unconditional old-chat preservation.
  Committed the tested implementation and continued independent phases under the run rules.

## Phase 6: Overlay Frames

- `exec_command`: wrote Frame tests first; the initial run failed because Frame did not yet
  exist. Implemented the shared wrapper, exported the editor's border style and routed all
  app overlay calls through it. Reserved two additional rows for the trace border.
- `exec_command`: verified the pinned pi component/focus interfaces, rendering behavior and
  application Esc paths. Added a narrow-width help integration check using the existing terminal
  harness. Frame checks cover widths 80/40, ANSI styles, CJK width, focus/input/invalidation,
  wrapped long titles, truncated entries and NO_COLOR.
- `exec_command` / `write_stdin`: build, lint (137 files), all 63 test files and 381 tests passed.
  Marked T012–T013 complete and committed with normal hooks.
- `exec_command`: read the convergence skill and documentation touchpoints in preparation for
  the remaining task phases. No convergence writes have been made yet.

## Phase 7: Documentation

- `exec_command`: updated the README command table and the explicitly authorized 006 command
  contract rows and removal note. A search equivalent to the quickstart grep found no obsolete
  in-app id suggestions in application source, README or the active contract.
- `exec_command` / `write_stdin`: build, lint and all 63 test files / 381 tests passed.
  Marked T014 complete and committed with normal hooks. The current feature spec, plan,
  research, data model, contract and quality checklist remain unchanged.
