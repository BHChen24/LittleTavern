# SDD development usage

Platform-reported development tokens: **unknown**. The agent interface does not expose usage
counts. No token counts are estimated. Application usage is separate and follows the feature spec.

The conversation's tool transcript is the per-invocation record: it identifies every outer
tool call and every nested tool call, their arguments and results. This report indexes the work
below without duplicating command output or secrets. Counts shown in tool output limits are
output-size estimates, not billed development usage.

| Tool invocations | Purpose | Outcome |
|---|---|---|
| `functions.exec` / `exec_command` | Read skill, prerequisites, constitution and feature artifacts; inspect working tree and checklists | Feature resolved; checklist 16/16; trace conflict found |
| `functions.exec` / `apply_patch` | Record the trace conflict in questions.md | Recorded; implementation paused |
| `functions.exec` / `exec_command` | Read amendment skill and template; inspect dependencies, pi v1.3.0 references and branches | Owner clarification accepted; APIs checked |
| `functions.exec` / `exec_command` | Amend principle V, synchronize plan and resolve question | Constitution 2.0.0; conflict resolved |
| `functions.exec` / `exec_command` / `apply_patch` | Switch to main and implement setup T001–T004 | Setup written; validation pending |

Subsequent invocations and their outcomes remain available individually in the tool transcript
and are summarized by phase in report.md.

Phase 1: build/lint passed, zero tests as planned; committed `4fd26d1`.
Phase 2: build/lint passed, 6 files and 20 tests passed. Used `exec_command` to write
modules, run Biome formatting and all checks, inspect pi APIs, and mark tasks complete.
Git switch initially failed because .git is sandbox read-only; escalation succeeded after
preserving changes in a temporary stash. pnpm auto-install initially failed on its external
store; checks now disable automatic dependency verification without installing anything.

Phase 3: `exec_command` wrote the chat test first (expected missing-module failure), then
implemented the adapter, UI and terminal cleanup. The first typecheck identified callback
narrowing and Text input-handler errors; both were corrected. Final build/lint and 24 tests
in 8 files passed, including T-i with a 54-line test file.

Phase 4: `exec_command` wrote credential storage, masked input, consent prompt and tests,
updated key state and CLI, and ran formatting/build/lint/tests. All 33 tests in 10 files passed.
T-i now includes entering a key and choosing session-only before editor input (59 lines).

Correction: the final T-i key-entry extension initially failed because it used getFocus()
instead of pi 1.3.0's getFocusedComponent(). Phase 4 was prematurely committed before
that result was inspected. The method is corrected and the commit is amended only after
all three checks pass.

Phase 5: `exec_command` implemented the append-only ledger, usage mapping, totals and UI
wiring, then wrote UI-level rejected-key and quit-during-stream tests. Build/lint and all
46 tests in 13 files passed. Quitting waits for the interrupted record; local key blocks
produce no extra record; the status matches ledger sums and errors are scrubbed.

Phase 6: `exec_command` implemented settings persistence, the fuzzy-filtered model picker
and app integration. Build/lint and all 48 tests in 15 files passed, including settings
round trips and a non-prefix model filter followed by selection/cancellation.
