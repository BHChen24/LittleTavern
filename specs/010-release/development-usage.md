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

## Release package

66. `exec_command` (escalated): commit import phase. Outcome: 7dc27e3; hooks passed.
67. `write_stdin`: collect import commit. Outcome: committed.
68. `exec_command`: add allowlist unit tests and run before implementation. Outcome: expected missing-module failure.
69. `exec_command`: implement bundler/manifest/pack and allowlist/tag/secret checker; format,
    run gate and release check. Outcome: build/lint and 342 tests passed; eight-file package built;
    sandbox blocked tar subprocess with EPERM.
70. `write_stdin`: collect packaging gate/check. Outcome: tar subprocess restriction confirmed.
71. `exec_command`: prepare isolated install smoke script in /tmp. Outcome: script created.
72. `exec_command` (escalated): rerun local release check. Outcome: exact eight files verified;
    gitleaks no findings; release check passed.
73. `write_stdin`: collect release check. Outcome: passed.
74. `exec_command` (escalated): run install smoke. Outcome: npm parsed unprefixed tarball path
    as GitHub shorthand; install failed before running the app.
75. `write_stdin`: collect initial smoke. Outcome: invalid GitHub shorthand error confirmed.
76. `exec_command`: check bad version tag. Outcome: expected exit 1 with mismatch reason.
77. `exec_command`: correct smoke path to explicit ./ and document implementation detail. Outcome: corrected.
78. `exec_command` (escalated): rerun isolated smoke. Outcome: installed 135 dependencies;
    version/import/list succeeded in temporary prefix/home.
79. `web.run`: inspect official gitleaks release and GitHub npm OIDC documentation. Outcome:
    release page loaded; attempted GitHub docs path unavailable. No external mutations.
80. `write_stdin`: collect corrected smoke. Outcome: passed.
81. `exec_command`: query public GitHub release asset metadata. Outcome: sandbox DNS blocked;
    no content returned, follow-up will use approved network access.
82. `exec_command`: record package/smoke evidence, mark T009-T011 and update usage. Outcome:
    packaging phase ready to commit.

## CI and release workflows

83. `exec_command` (escalated): commit packaging phase. Outcome: d9b2c15; hooks passed.
84. `write_stdin`: collect package commit. Outcome: committed.
85. `exec_command` (escalated): read gitleaks release asset names from the official GitHub API.
    Outcome: Linux x64 archive and checksum names verified.
86. `exec_command`: generate CI/tag-release workflows and parse YAML with existing yaml dependency;
    check matrix and publication dependencies; run gate. Outcome: valid workflows; build/lint and
    342 tests passed.
87. `write_stdin`: collect workflow gate. Outcome: passed.
88. `exec_command`: extract the checksum installer for temporary verification and scan full history.
    Outcome: 116 commits scanned, no leaks found.
89. `exec_command` (escalated): run the workflow's actual download/checksum/install step in /tmp.
    Outcome: archive checksum verified, installed gitleaks reports 8.30.1.
90. `write_stdin`: collect temporary installer verification. Outcome: succeeded.
91. `exec_command`: mark T012-T013 and update usage. Outcome: workflows ready to commit;
    live GitHub execution remains an owner check, no push/tag/publication performed.

## Release documentation

92. `exec_command` (escalated): commit workflows. Outcome: b8b46dd; hooks passed.
93. `exec_command`: read README, prior report structure and converge skill. Outcome: documentation
    edits scoped; convergence procedure loaded for T017.
94. `exec_command`: update npm install, Node wording, Alice quick start, source developer section,
    import description and AGENTS release commands; run gate. Outcome: build/lint and 342 tests passed.
95. `write_stdin`: collect documentation gate. Outcome: passed.
96. `exec_command`: review documentation diff and whitespace. Outcome: changes match T014-T015;
    no whitespace errors.
97. `exec_command`: mark T014-T015 and update usage. Outcome: documentation phase ready to commit.

## Final validation and convergence

98. `exec_command` (escalated): commit documentation. Outcome: 1e667f4; hooks passed.
99. `write_stdin`: collect documentation commit. Outcome: committed.
100. `exec_command` (escalated): run T016 full gate, correct-tag release check and external
     offline acceptance against this checkout. Outcome: build/lint, 342 tests, package checks
     and all 19 acceptance checks passed; record v1-acceptance-20261020-104839.md.
101. `exec_command`: assess bundler/checker, examples helper, browser and pinned pi autocomplete
     for convergence. Outcome: implementations match requirements; command completion removal
     confirmed against pi source.
102. `exec_command`: assess app dispatch/import, release workflow, implementation notes and CLI
     startup regression. Outcome: release is gated; generated fixtures used outside justified T-g.
103. `write_stdin`: collect final gate/package/acceptance. Outcome: all passed; no real provider used.
104. `exec_command`: check converge pre-hooks, run converge prerequisites once and enumerate
     requirements/tasks; inspect pi command autocomplete. Outcome: correct feature, no hooks;
     no argument completions without a command provider; one quickstart path gap identified.
105. `apply_patch`: append convergence T019 under Phase 9 without changing existing tasks.
     Outcome: one MEDIUM partial validation-guide correction appended.
106. `exec_command`: check convergence post-hooks. Outcome: no extension configuration; skipped.
107. `exec_command`: implement T019, consolidate notes and update usage. Outcome: quickstart
     uses the same explicit local tarball path as the successful smoke test.
108. `write_stdin`: collect final post-correction gate. Outcome: build/lint and 342 tests passed.
109. `exec_command`: count acceptance/edge inventory, verify corrected quickstart, check hooks
     and whitespace/status. Outcome: 17 acceptance scenarios, 9 edges, local path correct,
     no extension configuration and no whitespace errors.
110. `exec_command`: finalize report, mark T016-T019 and update usage. Outcome: all 19 tasks
     complete; validation evidence, manual owner work and convergence recorded.
111. `exec_command`: validate final task/checklist totals, branch, whitespace, hook absence,
     report structure and acceptance-record identity. Outcome: 19/19 tasks checked, all checklist
     items checked, correct feature branch; validation passed.
112. `exec_command` (escalated): commit the validated final report, convergence correction and
     task closure with normal hooks, then verify branch/status. Outcome is recorded by the final
     commit and verification output in the session transcript; no push, tag or publication.

## Phase 10: Combined startup failure (T020)

Platform-reported total tokens for this follow-up implementation: **unknown**. No run total is
exposed. The preceding convergence pass recorded its invocations in the session transcript;
its only repository write appended T020. `functions.exec` wrappers batch the invocations below.

113. `exec_command`: read implement skill, check hooks/prerequisites and branch/status. Outcome:
     correct feature branch; only the previously appended T020 was uncommitted; no hooks.
114. `exec_command`: read constitution, tasks and plan. Outcome: T020 is the only unchecked task;
     phase checkpoint and usage rules apply.
115. `exec_command`: read supporting artifacts/AGENTS and scan checklists. Outcome: 16/16 checked,
     marker retry and single-notice requirements confirmed.
116. `exec_command`: inspect startup/helper/tests and existing report/usage. Outcome: exact notice
     coordination point and lightweight existing test harness identified.
117. `exec_command`: verify git/ignore setup, spec edge cases and pinned pi component APIs.
     Outcome: ignore coverage sufficient; generated package uses its files allowlist; optional
     guessed container source path absent, with the actual Container found in tui.ts.
118. `exec_command`: add generated-fixture folder-only/settings-only/combined startup regression
     and run before implementation. Outcome: combined case failed with two notices; both isolated
     failure cases passed.
119. `write_stdin`: collect targeted regression result. Outcome: expected 1 failure, 2 passes.
120. `exec_command`: verify pinned pi Text/Container source and review pending task/test changes.
     Outcome: existing multiline Text supports a single combined notice; scope unchanged.
121. `exec_command`: combine startup setup messages into one notice, update usage, format and
     run full gate. Outcome: collected by the following entry.
122. `write_stdin`: collect phase gate progress. Outcome: build/lint passed, tests running.
123. `exec_command`: review app/test diff, whitespace and post-hook configuration. Outcome:
     change is limited to startup notice grouping and three regression cases; hooks absent.
124. `write_stdin`: collect full gate completion. Outcome: 345 tests passed in 61 files.
125. `exec_command` (escalated): rebuild and check the tagged release package. Outcome: same
     eight allowed files, version match and no package secret findings.
126. `write_stdin`: collect package check. Outcome: gitleaks scanned 166863 bytes; check passed.
127. `exec_command`: verify diff/status, remaining task and hooks. Outcome: T020 alone remained
     unchecked; intended files only; no extension hooks.
128. `exec_command`: mark T020, update report/implementation notes/usage and verify final metadata.
     Outcome: all 20 tasks checked; report records 345 passing tests and rebuilt package evidence.
129. `exec_command` (escalated): commit the validated T020 fix and report with normal hooks and
     verify branch/status. Outcome is recorded in the final commit/verification output in the
     session transcript; no push, tag or publication.
