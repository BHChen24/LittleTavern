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
| `functions.exec` / `exec_command` / `apply_patch` | Switch to main and implement setup T001–T004 | Setup complete; checks passed |

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
in 8 files passed, including T-i with a test file under 60 lines.

Phase 4: `exec_command` wrote credential storage, masked input, consent prompt and tests,
updated key state and CLI, and ran formatting/build/lint/tests. All 33 tests in 10 files passed.
T-i now includes entering a key and choosing session-only before editor input (55 lines).

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

Phase 7: `exec_command` wrote the opt-in live test without running it, formatted and ran
build/lint/default tests/version successfully (48 tests, 15 files), inspected import
boundaries and remaining tasks, and wrote this report and the final task status.
Constitution Sync Impact: 1.1.0 -> 2.0.0; principle V redefined by owner clarification.
The temporary constitution HTML review comment was removed before committing as its skill
requires. No template was modified. No extension hooks file was present.

Convergence: `exec_command` read the convergence skill and prerequisites, inspected the
in-scope source against the artifacts, and appended T036/T037 for two partial gaps.
`apply_patch` corrected the status renderer and disabled Vite environment-file loading.
`exec_command` reran build/lint/48 default tests/version, checked narrow status rendering,
and inspected the resolved Vite configurations. The first one-off Vite inspection failed
on a normalized pnpm dependency path; resolving relative to Vitest succeeded. Final checks
passed. Earlier default test runs may have let Vite read .env; the final configuration
explicitly prevents that. Synthetic keys and simulated providers were used in every test.
The report and task state were updated, and the final review found no remaining buildable gaps.
Final git checks/commit are recorded individually in the conversation tool transcript.
Total development tokens remain unknown: no platform measurement is exposed.
