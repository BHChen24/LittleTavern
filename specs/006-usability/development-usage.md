# SDD development usage: 006-usability

Platform-reported total development tokens: **unknown**. The platform does not expose a run total to this agent.

Every invocation is recorded below by purpose and outcome. Commands use local files and synthetic fixtures; no secrets are included. Recorder calls include the enclosing functions.exec invocation.

| Purpose | Tools | Outcome |
|---|---|---|
| Read implement skill, check hooks, branch, worktree and prerequisites | functions.exec → exec_command | Clean 006-usability; prerequisites passed; no extensions file |
| Read tasks and constitution; scan checklists and setup files | functions.exec → exec_command | 16/16 checklist items checked |
| Read feature artifacts and current app | functions.exec → exec_command | Read; repeated truncated sections in subsequent calls |
| Read paths, components, exports and ignore setup | functions.exec → exec_command | Existing ignores cover setup; packages are private, no publishing ignore needed |
| Read spec, app tests, pinned pi APIs and prior report | functions.exec → exec_command | Verified SlashCommand and CombinedAutocompleteProvider locally |
| Initialize this invocation recorder and usage log | functions.exec → exec_command | Written |
| Read remaining spec, test harnesses and library shapes | functions.exec → exec_command (including this recorder) | Exit 0 |
| Write foundational tests before implementation (T001–T003) | functions.exec → exec_command (including this recorder) | Exit 1 |
| Implement import paths and command catalog (T001–T003) | functions.exec → exec_command (including this recorder) | Exit 0 |
| Wait for Phase 1 checks (two calls) | functions.exec → write_stdin × 2 | Build, lint and 222 tests passed |
| Commit Phase 1 and wire command suggestions and dispatch (T004) | functions.exec → exec_command (including this recorder) | Exit 0 |
| Commit Phase 1 outside sandbox and wait for Phase 2 checks | functions.exec → exec_command (escalated Git), write_stdin | Committed ae68668; 223 tests, build and lint passed |
| Mark Phase 2 complete and record commit metadata limitation | functions.exec → exec_command (including this recorder) | Exit 0 |
| Write file browser tests (T006) | functions.exec → exec_command (including this recorder) | Exit 1 |
| Commit Phase 2 | functions.exec → exec_command (escalated Git) | Committed a277135 |
| Wait for browser test baseline | functions.exec → write_stdin | Expected missing-module failure before implementation |
| Implement browser and import startup wiring (T006–T007) | functions.exec → exec_command (including this recorder) | Exit 0 |
| Wait for Phase 3 validation | functions.exec → write_stdin | Build, lint and 227 tests passed |
| Mark Phase 3 complete and prepare home screen tests (T008) | functions.exec → exec_command (including this recorder) | Exit 0 |
| Add home content and app navigation tests before implementation (T008–T009) | functions.exec → exec_command (including this recorder) | Exit 1 |
| Commit Phase 3 | functions.exec → exec_command (escalated Git) | Committed 69647f9 |
| Wait for home test baseline | functions.exec → write_stdin | Expected missing HomeScreen / enterChat failures |
| Implement home screen, chat entry and update existing harnesses (T008–T009) | functions.exec → exec_command (including this recorder) | Exit 1 |
| Wait for Phase 4 checkpoint | functions.exec → write_stdin | Lint caught a misplaced harness call; corrected before commit |
| Fix chat-entry test placement and validate Phase 4 | functions.exec → exec_command (including this recorder) | Exit 0 |
| Wait for corrected Phase 4 checkpoint | functions.exec → write_stdin | Build, lint and 231 tests passed |
| Mark Phase 4 complete and inspect key/error interfaces for Phase 5 | functions.exec → exec_command (including this recorder) | Exit 0 |
| Inspect editor submit order and write key-flow tests (T010) | functions.exec → exec_command (including this recorder) | Exit 1 |
| Commit Phase 4 | functions.exec → exec_command (escalated Git) | Committed b9d61d4 |
| Wait for key-flow baseline | functions.exec → write_stdin | Expected old-flow failures |
| Inspect pi overlay lifecycle and editor submission order | functions.exec → exec_command (including this recorder) | Exit 0 |
| Implement explicit API-key flow and missing-key interception (T010) | functions.exec → exec_command (including this recorder) | Exit 0 |
| Wait for initial key-flow checks (two polls) | functions.exec → write_stdin × 2 | Build, lint and 237 tests passed; inspected pi overlay stacking and strengthened cleanup |
| Correct usage outcome and review message roles and terminal startup | functions.exec → exec_command (including this recorder) | Exit 0 |
| Close each key-flow overlay before advancing and verify overlay cleanup | functions.exec → exec_command (including this recorder) | Exit 0 |
| Wait for strengthened Phase 5 validation | functions.exec → write_stdin | Build, lint and 237 tests passed, including overlay cleanup |
| Mark Phase 5 complete and document the safe manual-check command | functions.exec → exec_command (including this recorder) | Exit 0 |
| Write label and status-layout tests before polish (T011) | functions.exec → exec_command (including this recorder) | Exit 1 |
| Commit Phase 5 | functions.exec → exec_command (escalated Git) | Committed a4dcc81 |
| Wait for label test baseline | functions.exec → write_stdin | Expected missing-label failures |
| Apply message styles and compact transcript spacing (T011) | functions.exec → exec_command (including this recorder) | Exit 0 |
| Wait for Phase 6 automated checkpoint | functions.exec → write_stdin | Build, lint and 237 tests passed |
| Prepare isolated terminal smoke check and read convergence workflow | functions.exec → exec_command (including this recorder) | Exit 0 |
| Launch isolated built CLI in a PTY | functions.exec → exec_command | Home screen displayed; no environment file loaded |
| Exercise Enter, suggestions, browser import, chat greeting, no-key send and Ctrl+C | functions.exec → write_stdin × 9 | Expected layout and notices observed; exit 0; no requests |
| Record terminal observations and mark Phase 6 complete | functions.exec → exec_command (including this recorder) | Exit 0 |
