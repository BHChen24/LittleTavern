---
description: "Task list for 010-release"
---

# Tasks: Release v0.1

**Input**: Design documents from `specs/010-release/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/release-package.md,
quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-i).

**Read before starting**:

- `research.md` R1–R8. They hold every decision and the facts already checked.
- `contracts/release-package.md`: the exact package allowlist, the generated manifest, the
  commands and every user-visible message.
- `data-model.md`: the `examplesAdded` marker and its state transitions.
- The current `packages/data/src/library.ts` (`importFile`), `packages/tui/src/cli.ts`,
  `packages/tui/src/components/file-browser.ts`, and the `/import` handler and
  `importCompletions` in `packages/tui/src/app.ts` and `packages/tui/src/commands.ts`.
- `examples/` (already committed): the Alice card, the Wonderland lorebook, their README and the
  CC0 license. Do not change their content.

## Rules for this run (unattended)

- **Stay on branch `010-release`.** Never commit to `main`, and never switch, merge or rebase
  branches. **Never push, tag or publish**, and never run `npm publish` or `gh release`.
- **Do not stop to ask, but do not invent behaviour.** Two kinds of question:
  - an *implementation detail* (naming, structure, which API to call): choose the simplest
    option that satisfies the spec, and note it in `specs/010-release/questions.md`;
  - *behaviour the spec, plan, research or contract do not define*: do not decide it. Leave the
    affected task unchecked, record the question in `questions.md` for the owner, and continue
    with the other tasks.
- **Too complex tests**: record them under "Deferred tests" in the report.
- **Never**:
  - read, print or use `.env`;
  - run `pnpm test:live`;
  - add a dependency other than `esbuild`;
  - touch the real `~/.littletavern` or the real settings (tests and checks use temporary
    `LITTLETAVERN_HOME` folders);
  - launch a real editor;
  - bypass the git hooks with `--no-verify`, or edit `.gitleaksignore`. If gitleaks flags
    something, record it in `questions.md` and stop that task.
- **English only** (constitution 3.1.0).
- **Constitution V**: record tool calls and total tokens (or "unknown") in
  `specs/010-release/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message and mark the finished tasks `[X]` in the same commit.
- **No network?** The install smoke test (T011) and the workflows need it. Record them as deferred
  to CI and the owner and continue.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `esbuild` `0.28.2` as a root devDependency (`pnpm add -D -w esbuild@0.28.2`) and add `release/` to `.gitignore`. Check `pnpm exec esbuild --version`. Only if it fails because the install script was denied, add `esbuild: true` under `allowBuilds` in `pnpm-workspace.yaml`, with a one-line comment like the existing entries (research R1)

**Checkpoint**: checks pass. Commit.

---

## Phase 2: Foundational

- [X] T002 Add `examplesAdded?: boolean` to `Settings` in `packages/data/src/settings.ts`, "validated as a boolean like `mouse`" (data-model.md). Extend `packages/data/src/settings.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 1 - Install with one command and play at once (P1)

**Goal**: the first interactive start adds Alice with Wonderland attached, once.

**Independent test**: a temporary home, one simulated first start, then Alice is in the library
with Wonderland attached; a second start changes nothing.

- [X] T003 [US1] Create `packages/data/src/examples.ts` with `addExamplesOnce(paths, examplesDir: string | null): { notice?: string }`, following research R5 steps 1–6 exactly. It never throws. It creates the import folders itself first; it imports **from `examplesDir`**, not from the copies; a failed marker write returns the "could not save settings" notice and leaves the marker absent. Export it through the data barrel. Write tests T-d in `packages/data/src/examples.test.ts` with **code-generated** example files (use the existing synthetic card and lorebook helpers) in a temporary folder, covering every case listed for T-d in plan.md
- [X] T004 [P] [US1] Create `packages/tui/src/examples-dir.ts` with `examplesDir(): string | null` (research R5: the release layout `../examples/` first, then the development layout `../../../examples/`, relative to the built file). Write test T-e
- [X] T005 [US1] In `packages/tui/src/cli.ts`, on the interactive path only, call `addExamplesOnce(resolveAppPaths(), examplesDir())` right before `startApp()`, and pass its notice to the app so that it is shown once, like the import-folder notice (extend `startApp`/`createApp` options with an optional `startupNotices: string[]`). Subcommands must not call it (FR-005); write test T-j. Write the happy path T-g (the plan's one justified use of the shipped `examples/` files) in `packages/engine/src/examples-chat.test.ts`: in a temporary home, `addExamplesOnce` with the real `examples/`, then a simulated `CharacterChat` with Alice sends "Have you seen the Cheshire Cat?", and `lastTrace` includes the Wonderland entry "The Cheshire Cat"

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 2 - Import stays inside the import folders (P1)

**Goal**: the app's `/import` cannot read outside the import root; no import reads non-regular or
oversized files.

**Independent test**: `/import foo` is refused, the browser has no `..` at the root, an outside
link is refused, and an oversized file is refused by both the app and the CLI.

- [X] T006 [P] [US2] In `packages/data/src/library.ts`, export `MAX_IMPORT_BYTES = 20 * 1024 * 1024` and make `importFile` `statSync` the path before reading: "not a regular file" for anything but a regular file, "larger than 20 MB" above the limit (research R6, contract messages). Write tests T-a in `packages/data/src/library.test.ts`: a directory, a FIFO (skip on Windows), a sparse file one byte over the limit, and a normal card that still imports
- [X] T007 [P] [US2] In `packages/tui/src/components/file-browser.ts`, add a `root` (constructor argument) per research R6: no `..` entry at the root, and never a directory outside it. Write tests T-b
- [X] T008 [US2] In `packages/tui/src/app.ts`, `packages/tui/src/commands.ts` and `packages/data/src/paths.ts` (research R6, contract):
  - `/import` with any argument shows the contract message and imports nothing;
  - the browser is created with the import root as its root;
  - a selected file whose real path is outside the real import root is refused with `<file name> is outside the import folders.`;
  - `/import` loses its `argumentHint` and its completion; delete `importCompletions`; the description becomes "Import a card or lorebook from the import folders";
  - `ensureImportFolders`' failure message becomes the contract's text;
  - `EMPTY_LIBRARY_HINT` in `packages/tui/src/library-format.ts` becomes `Library is empty. Put cards in the import folders and use /import, or run "littletavern import <file>".`, and its test follows; then search the source (`grep -rn "/import <" packages`) and fix any other suggestion of `/import <path>` (FR-010);
  - update the `/import` row in `specs/006-usability/contracts/commands.md` with the note "changed by 010".

  Write tests T-c, and update the existing tests that used `/import <path>` to use the browser or the CLI.

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 4 - Releasing is one tag: the package (P2)

Done before User Story 3 because the CI workflows call these commands.

**Goal**: one local command builds the package and proves its contents are exactly the allowlist,
with no secrets.

**Independent test**: `pnpm release:check` passes on a clean build and fails, naming the file,
when an extra file is added.

- [ ] T009 [US4] Create `scripts/build-release.mjs` per research R1 and R2 and the manifest in `contracts/release-package.md`: recreate `release/`, bundle `packages/tui/dist/cli.js` into `release/dist/cli.js` with esbuild (only `@littletavern/*` bundled, every third-party runtime dependency external), write `release/package.json`, copy `README.md`, `LICENSE` and `examples/`, then run `npm pack` in `release/`. Add the root script `"release:build": "pnpm build && node scripts/build-release.mjs"`
- [ ] T010 [US4] Create `scripts/check-release.mjs` per research R3: compare the tarball's file list with the exact allowlist in the contract (export the comparison as a function), run `gitleaks dir --redact --no-banner` on an extracted copy, and with `--tag <tag>` require `tag === "v" + version`. Exit 1 on any failure, naming it. Add `"release:check": "pnpm release:build && node scripts/check-release.mjs"`. Write test T-f in `scripts/check-release.test.ts` against the exported function
- [ ] T011 [US4] Run `pnpm release:check` (T-h) and record its output in the report. If the network is available, run the install smoke test from `quickstart.md` (T-i) in a temporary prefix and home and record the result; otherwise record it as deferred to CI and the owner

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 3 - Every change is checked automatically (P2)

**Goal**: workflows for every push and pull request, and for version tags.

**Independent test**: both files parse as YAML and match research R7. They run for real only
after the owner pushes (quickstart).

- [ ] T012 [P] [US3] Create `.github/workflows/ci.yml` per research R7: on push and pull request; a matrix job on Node `22.19.0`, `24` and `26` running `pnpm install --frozen-lockfile` (with `HUSKY=0`), `pnpm build`, `pnpm lint` and `pnpm test`; a single secret-scan job (not per Node version) that installs gitleaks `8.30.1` from its GitHub release, verifies the checksum, and runs `gitleaks git --redact --no-banner .` on full history; and a package job that installs gitleaks the same way, runs `pnpm release:check` and the install smoke test from `quickstart.md`
- [ ] T013 [P] [US3] Create `.github/workflows/release.yml` per research R7: on tags `v*`; the same checks; `pnpm release:check --tag "$GITHUB_REF_NAME"`; the smoke test; `npm publish release/littletavern-<version>.tgz --provenance --access public` with `NODE_AUTH_TOKEN` from `secrets.NPM_TOKEN` and `id-token: write`; then `gh release create "$GITHUB_REF_NAME" release/*.tgz --generate-notes` with `contents: write`. Check that both workflow files parse as YAML (for example with `node -e` run from `packages/data`, which already depends on `yaml`)

**Checkpoint**: checks pass. Commit.

---

## Phase 7: User Story 5 - The README matches the release (P3)

- [ ] T014 [US5] Update `README.md` (FR-014): the install section becomes `npm install -g littletavern`, with "Node.js 22.19 or newer (tested on 22, 24 and 26)"; the quick start mentions that Alice and the Wonderland lorebook are ready on first start; installing from source moves into the Development section; `/import` is described as importing from the import folders, with `littletavern import <file>` for other locations. Keep everything else
- [ ] T015 [US5] Add `pnpm release:build` and `pnpm release:check` to the Commands table in `AGENTS.md`, with one line each

**Checkpoint**: checks pass. Commit.

---

## Phase 8: Polish

- [ ] T016 Run `pnpm build && pnpm lint && pnpm test`, `pnpm release:check`, then `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`, so that it tests this checkout's build. Fix any failures
- [ ] T017 Run `speckit-converge` on this feature and complete any appended tasks
- [ ] T018 Write `specs/010-release/report.md` with the same sections as the earlier reports, including the `release:check` output, the smoke test result or its deferral, and the owner's manual checks and release checklist from `quickstart.md`. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

- US1 (Phase 3) needs T002.
- US2 (Phase 4) is independent of US1.
- US4 (Phase 5) needs T001. Its package includes the examples, so it comes after US1.
- US3 (Phase 6) needs US4's commands.
- US5 (Phase 7) describes US1, US2 and US4.

**Parallel**: T004 alongside T003; T006 and T007; T012 and T013.

## Implementation Strategy

US1 and US2 make the app itself ready; US4 makes it shippable; US3 and US5 make it maintainable
and readable. The feature is complete only when all phases are done. If a run is interrupted,
leave the remaining tasks unchecked and say so in the report; do not present a partial run as
delivered.
