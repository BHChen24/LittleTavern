# Development Usage: Release v0.1

Platform-reported total development tokens: **unknown**. No platform total is available;
no estimates or zero counts are substituted. Each entry records one tool invocation, its purpose
and its outcome. `functions.exec` wrappers batch the listed tools; full inputs and outputs are
in the session transcript. No environment file or real credentials are read or used.

## Setup

1. `exec_command`: read implement skill, check pre-hooks and prerequisites. Outcome: active
   feature 010-release found, required artifacts present, no extension hooks.
2. `exec_command`: check branch/status and read constitution and AGENTS. Outcome: clean feature
   branch; constraints loaded.
3. `exec_command`: scan checklists and read tasks/plan. Outcome: 16/16 checked; plan loaded.
4. `exec_command`: read research, data model, contract and quickstart. Outcome: revised decisions loaded.
5. `exec_command`: read spec, test matrix, ignore/configuration and tool versions. Outcome: inputs loaded.
6. `exec_command`: read settings/fixture/CLI/chat tests. Outcome: existing test patterns identified.
7. `exec_command`: read data exports and seek adapter path. Outcome: exports read; guessed adapter
   path absent, command stopped; no changes.
8. `exec_command`: inspect ignore/configuration, Node/pnpm/gitleaks, instructions and pi pin.
   Outcome: Node 26.7, pnpm 11.21, gitleaks 8.30.1 and pi v1.3.0 confirmed; guessed adapter
   directory absent. Existing ignore patterns sufficient; publishing uses a generated files allowlist.
9. `exec_command`: read settings, fixtures, CLI/app tests, hooks and context7 skill. Outcome:
   local test conventions loaded; implementation uses the approved plan and pinned pi reference.
10. `exec_command`: attempt offline esbuild install. Outcome: sandbox blocked pnpm store database.
11. `exec_command`: read file-browser tests/commands and search adapters. Outcome: tests and
    commands loaded; guessed adapter pattern had no matches.
12. `exec_command` (escalated): retry offline esbuild install. Outcome: cache metadata reports
    latest 0.28.1, cannot resolve required 0.28.2.
13. `exec_command` (escalated): query npm for esbuild 0.28.2. Outcome: exact version exists online.
14. `exec_command`: check status, recent commits, dependency state and post-hook file. Outcome:
    clean; design corrections committed in 2644ab4; no extension hooks.
15. `exec_command` (escalated): install exact esbuild online. Outcome: install started.
16. `write_stdin`: collect esbuild install. Outcome: dependency installed but pnpm exited 1 because the esbuild script was denied.
17. `exec_command`: add release/ ignore and initialize this usage record. Outcome: documentation
    and ignore changes prepared; no .npmignore needed because only generated release/ is packed.
18. `exec_command` (escalated): check esbuild via pnpm. Outcome: automatic dependency-state
    install started; collected in entry 19.
19. `write_stdin`: collect pnpm exec. Outcome: blocked install scripts caused pnpm to exit 1.
20. `exec_command`: invoke the installed esbuild binary directly. Outcome: 0.28.2 works without
    an install script.
21. `exec_command`: explicitly deny esbuild builds and record implementation details. Outcome:
    no install script enabled; setup notes and usage updated.
22. `exec_command` (escalated): attempt setup gate. Outcome: pnpm had inserted an esbuild
    approval placeholder, causing a duplicate YAML key alongside the explicit denial.
23. `exec_command`: remove pnpm's placeholder while keeping the explicit denial. Outcome:
    one valid esbuild entry remains.
24. `exec_command` (escalated): finish offline install and setup gate. Outcome: esbuild 0.28.2,
    build, lint and all 313 tests passed (56 files).
25. `write_stdin`: collect setup gate progress. Outcome: build/lint passed; tests running.
26. `exec_command`: locate app import regressions and trace types. Outcome: app tests and trace
    fields identified; an optional guessed test filename did not exist.
27. `write_stdin`: collect setup gate completion. Outcome: all 313 tests passed.
28. `exec_command`: mark T001, update usage and commit setup. Outcome: hook result in transcript.
29. `exec_command` (escalated): commit setup with hooks. Outcome: e8a74aa; secret scan/lint passed.
30. `write_stdin`: collect setup commit. Outcome: committed.
31. `exec_command`: add marker test and run it before implementation. Outcome: expected missing-field failure.
32. `exec_command`: implement optional validated boolean and run full phase gate. Outcome: all 314 tests passed; build/lint passed.
33. `write_stdin`: close expected failing test session. Outcome: exit 1 as expected before implementation.
34. `write_stdin`: collect phase gate. Outcome: passed.
35. `exec_command`: inspect app/command regressions, chat setup and tool configuration. Outcome: integration paths identified; no other ignore files required.
36. `exec_command`: mark T002 and update usage. Outcome: foundational phase ready to commit.

## First-start examples

37. `exec_command` (escalated): commit foundational marker. Outcome: 6a96de8; hooks passed.
38. `write_stdin`: collect foundational commit. Outcome: committed.
39. `exec_command`: add generated-fixture unit tests, locator test, shipped-content faux happy
    path and parameterised subcommand regression. Outcome: tests started before implementation.
40. `write_stdin`: collect new tests. Outcome: expected missing-module/export failures.
41. `exec_command`: implement examples helper, locator, exports and interactive startup notice
    integration; format and run gate. Outcome: build/lint passed, 330 tests passed; one lint warning.
42. `write_stdin`: collect first examples gate progress. Outcome: tests running.
43. `write_stdin`: collect first examples gate. Outcome: 330 passed.
44. `exec_command`: fix optional-chain warning and test CLI startup/notice forwarding with a
    mocked terminal launch. Outcome: full gate started; 332 tests passed.
45. `write_stdin`: collect gate. Outcome: build/lint and 332 tests passed.
46. `exec_command`: use generated content in the CLI startup test, keeping shipped-content
    exception limited to T-g; run gate. Outcome: build/lint and 332 tests passed.
47. `write_stdin`: collect generated-content gate. Outcome: passed.
48. `exec_command`: inspect import handlers, regressions and pinned pi faux/native references.
    Outcome: migration points confirmed; brace-expanded optional search included nonexistent paths.
49. `exec_command`: mark T003-T005 and update usage. Outcome: examples phase ready to commit.

## Import boundaries

50. `exec_command` (escalated): commit examples phase. Outcome: 9af2bda; hooks passed.
51. `write_stdin`: collect examples commit. Outcome: committed.
52. `exec_command`: add file checks, root navigation and no-completion tests; run targeted red
    cases (not the FIFO before implementation). Outcome: three expected failures.
53. `write_stdin`: collect red cases. Outcome: expected failures confirmed.
54. `exec_command`: add app path-refusal and file/directory link tests. Outcome: expected failures.
55. `write_stdin`: collect app red cases. Outcome: expected failures confirmed.
56. `exec_command`: implement stat checks, browser root, realpath selection validation, updated
    messages/completion and prior command contract; run full gate. Outcome: build/lint passed;
    one dispatcher regression remained.
57. `write_stdin`: collect gate progress. Outcome: failing app assertion observed.
58. `exec_command`: search obsolete import hints. Outcome: none in source; no-match exit stopped
    optional subsequent reads.
59. `write_stdin`: collect gate. Outcome: 337 passed, one path-refusal test failed.
60. `exec_command`: inspect failed assertion and diff. Outcome: dispatcher returned Unknown command.
61. `exec_command`: inspect dispatch validation. Outcome: no-hint commands rejected arguments
    before reaching the new handler.
62. `exec_command`: permit import arguments through dispatch solely for the refusal message,
    add browser and CLI oversized cases and exact empty hint assertion; run gate. Outcome:
    build/lint and 340 tests passed.
63. `write_stdin`: collect successful gate. Outcome: 340 passed in 60 files.
64. `exec_command`: search source hints, inspect installed esbuild types and check diff. Outcome:
    no obsolete hints; diff clean; bundler options confirmed locally.
65. `exec_command`: mark T006-T008 and update usage. Outcome: import phase ready to commit.
