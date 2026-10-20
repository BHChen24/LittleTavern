---
description: "Task list for 006-usability"
---

# Tasks: Usability Pass

**Input**: Design documents from `specs/006-usability/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/commands.md,
quickstart.md

**Tests**: these come from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-j).

**Read before starting**:

- `research.md`, in particular:
  - R1: the `COMMANDS` table and the argument sources;
  - R2: the import root and the browser;
  - R3: the home screen;
  - R4: the key flow table;
  - R5: the polish items;
  - R6: the language test.
- The current `packages/tui/src/app.ts`, which holds every command from 001 to 005.

## Rules for this run (unattended)

- **Stay on branch `006-usability`.** Never commit to `main`, and never switch, merge or rebase
  branches.
- **Do not stop to ask.** If something is unclear, write it to `specs/006-usability/questions.md`,
  take the most conservative option, and continue.
- **Tests that are too complex**: record them under "Deferred tests" in the report.
- **Off limits**:
  - never read, print or use `.env`;
  - never run `pnpm test:live`;
  - never add a dependency;
  - never touch the real `~/.littletavern` in tests; always set `LITTLETAVERN_HOME`.
- **English only** (constitution 3.1.0): code, comments, strings and docs.
- **Constitution V**: record your tool invocations and the run's platform-reported total tokens
  (or "unknown") in `specs/006-usability/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message. Mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [X] T001 [P] Add `importRoot`, `importCharactersDir` and `importLorebooksDir` to `AppPaths` in `packages/data/src/paths.ts`:
  - by default, `join(os.homedir(), ".littletavern")`;
  - when `LITTLETAVERN_HOME` is set, `join(LITTLETAVERN_HOME, "import")`.

  Add `ensureImportFolders(paths): string | null`. It creates both folders recursively, never
  touches existing files, and returns a notice instead of throwing on failure. Write tests T-c in
  `paths.test.ts`.
- [X] T002 [P] Add the language test T-i in `packages/tui/src/language.test.ts`, per research R6.
  It must pass on the current tree.
- [X] T003 Create `packages/tui/src/commands.ts`:
  - a `COMMANDS` table with exactly the entries and descriptions in `contracts/commands.md`, in
    pi-tui `SlashCommand` shape;
  - argument completions per research R1, with sources injected through a small context object
    `{ paths, getChat }` so they can be tested;
  - `helpText()`, generated from `COMMANDS` plus a fixed key-binding block (Ctrl+C, Ctrl+R, Esc,
    Enter).

  Write tests T-a and T-b in `commands.test.ts`.

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - Commands suggest themselves (P1) 🎯

- [X] T004 [US1] In `app.ts`:
  - attach `new CombinedAutocompleteProvider(COMMANDS(context), paths.importRoot)` to the editor
    with `editor.setAutocompleteProvider`;
  - replace `APP_HELP` with `helpText()`;
  - make command dispatch look up `COMMANDS` names. Keep the existing handlers and move them
    behind the table; behaviour must not change.
- [X] T005 [US1] Try T-j in `packages/tui/src/app-suggestions.test.ts` (typing `/` opens suggestions, Tab completes). Defer it if the harness needs more than about 60 lines

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 2 - Import by choosing a file (P1)

- [X] T006 [P] [US2] Create `FileBrowser` in `packages/tui/src/components/file-browser.ts` per research R2, reusing `ListPicker`. Write tests T-d in `file-browser.test.ts` using a temporary directory
- [X] T007 [US2] In `app.ts`:
  - call `ensureImportFolders(paths)` at startup and show its notice if it returns one;
  - make `/import` with no argument open `FileBrowser` at `paths.importRoot` in an overlay;
  - on selecting a file, run `importFile` and show `formatImportReport` as a notice;
  - leave `/import <path>` unchanged.

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 3 - A home screen to start from (P1)

- [X] T008 [P] [US3] Create `HomeScreen` in `packages/tui/src/components/home-screen.ts` per research R3. Its constructor takes `{ version, keyStatus, libraryEmpty, importDirs }`. Write the content part of T-e in `home-screen.test.ts`
- [X] T009 [US3] In `app.ts`:
  - start with only `HomeScreen` as a child;
  - on Enter, show the chat layout and focus the editor;
  - expose `enterChat()` for tests;
  - make sure Ctrl+C on the home screen quits.

  Update the existing app tests to call `enterChat()` first. Add the Enter part of T-e.

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 4 - API key only through `/apikey` (P1)

- [X] T010 [US4] Rework the key flow in `app.ts` and `components/key-prompt.ts`, following the table in research R4:
  - no prompt at startup;
  - interception that restores the editor text;
  - the rejected-key notice points to `/apikey`;
  - `/apikey` shows a provider list with only OpenRouter, then the masked input, then the save
    choice with "Use for this session only" first and preselected;
  - "Forget saved key" appears only when a saved key exists;
  - `/key` and `/forget-key` answer that they were replaced.

  The environment-key rules stay unchanged. Write tests T-f and T-g in `app-apikey.test.ts`.

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 5 - Earlier polish notes (P3)

- [X] T011 [US5] Apply research R5 in `app.ts` and `theme.ts`:
  - the status bar is the last line;
  - labels `You:`, `<character name>:` (or `Assistant:` in plain chat) and a `·` prefix for
    notices, plus their styles;
  - no doubled separator.

  Write tests T-h. Check the look manually with `pnpm dev`, and record what you saw in the report.

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Polish

- [ ] T012 Run `pnpm build && pnpm lint && pnpm test`, then `bash ../acceptance/run-v1-acceptance.sh --auto-only`. The 19 automated checks must still pass (SC-005). If one fails because of an intended behaviour change, record it in the report rather than weakening the app
- [ ] T013 Run `speckit-converge` on this feature and complete any tasks it appends
- [ ] T014 Write `specs/006-usability/report.md` with the same sections as the earlier reports, plus a "Guided acceptance changes" section. That section lists the steps of `../acceptance/run-v1-acceptance.sh` that must change for the owner: the key prompt at startup is gone, `/apikey` replaces it, there is a home screen, and `/import` has a browser. Do not edit that script, because it is outside the repository. Commit

---

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7. Phases 2 to 6 all edit `app.ts`, so run them in sequence.

**Parallel**: T001 and T002. T006 can be written alongside T004 and T005, and T008 alongside
T007.

## Implementation Strategy

1. Phases 1–2 address the owner's first complaint, discoverability.
2. Phase 3 adds importing without typing paths.
3. Phases 4–5 add the home screen and the key flow the owner asked for.
4. Phase 6 adds the polish, which is lowest priority and can be trimmed if time runs short.

## Phase 8: Convergence

- [X] T015 Show the complete save destination with wrapping text in `components/key-prompt.ts`, so narrow terminals do not hide part of the path; retain the session-only default. Show the active source in the provider action picker and test it. Per FR-012 and FR-011 (partial, HIGH).
- [X] T016 Add focused tests for filtering hundreds of import files, and for app startup/browser failure when the import root is a file while explicit `/import <path>` still works. Per spec Edge Cases and Constitution testing policy (partial, MEDIUM).
- [X] T017 Verify Ctrl+R without a key preserves editor text and sends nothing, and scan the isolated home after quitting a session-only key flow to confirm no key material was persisted. Per FR-010 and SC-004 (partial, MEDIUM).
