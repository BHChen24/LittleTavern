---
description: "Task list for 007-character-creator"
---

# Tasks: Character Creator

**Input**: Design documents from `specs/007-character-creator/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/template.md, quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-h).

**Read before starting**:

- `contracts/template.md`: the exact template, the field mapping and the file locations.
- `research.md`:
  - R1: the editor launch;
  - R2: the parser steps;
  - R3: card building, file names and drafts.
- The 006 code: `paths.importRoot`, `importCharactersDir`, `COMMANDS`.

## Rules for this run (unattended)

- **Stay on branch `007-character-creator`.** Never commit to `main`, and never switch, merge or
  rebase branches.
- **Do not stop to ask.** If something is unclear, write it to
  `specs/007-character-creator/questions.md`, take the most conservative option, and continue.
- **If a test is too complex to write**, record it under "Deferred tests" in the report.
- **Never**:
  - read, print or use `.env`;
  - run `pnpm test:live`;
  - add a dependency;
  - touch the real `~/.littletavern`;
  - launch a real editor in tests (use a fake `VISUAL` script).
- **English only** (constitution 3.1.0), including the template text.
- **Constitution V**: record your tool calls and the platform-reported total tokens, or
  "unknown", in `specs/007-character-creator/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [X] T001 [P] In `packages/data/src/cards/template.ts`, add:
  - `CHARACTER_TEMPLATE`, exactly the text in `contracts/template.md`;
  - `parseCharacterTemplate(text)`, following research R2.

  Write tests T-a in `template.test.ts`. They include CJK text and `{{user}}` inside sections,
  which is allowed as test data.
- [X] T002 [P] In the same file, add `buildV3Card(fields, entries, version)` following the mapping in `contracts/template.md`, and `safeCardFileName(name, existingNames)` following research R3. Write tests T-b and T-c
- [X] T003 [P] Create `openInEditor(filePath, command?)` in `packages/tui/src/editor-launch.ts`, following research R1. Write tests T-e in `editor-launch.test.ts`, using a temporary Node script as the fake `VISUAL`

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Stories 1–3 - Write a character, keep drafts, standard card file (P1/P2) 🎯 MVP

- [X] T004 [US1] Create `createCharacterFromDraft(paths, draftPath, version)` in `packages/data/src/create-character.ts`. It:
  1. reads the draft;
  2. treats an unchanged template as cancelled;
  3. parses the draft, and on an error keeps it;
  4. builds the card and writes `<importCharactersDir>/<safe name>.json`;
  5. calls `importFile`;
  6. deletes the draft only if the import succeeded.

  It returns the import report with the parse warnings attached, or `{ cancelled }`, or
  `{ error, draftPath }`. Export it through the engine barrel. Write tests T-d.
- [X] T005 [US1] Add `littletavern create <file.md>` to `packages/tui/src/cli.ts`. It uses `createCharacterFromDraft` on the given file, but **never deletes a file the owner passed in**: add an option that keeps the source. It prints the report and warnings, and returns 1 on error. Add it to `CLI_HELP`. Write tests T-f
- [X] T006 [US2] Add `/new-character` to `COMMANDS` and handle it in `app.ts`:
  - **existing drafts**: if there are drafts in `<importRoot>/drafts/`, show a `ListPicker` with "Continue <file name>" for each draft, plus "Start a new character";
  - **new draft**: write `CHARACTER_TEMPLATE` to `drafts/new-character-<timestamp>.md`;
  - **editing**: call `tui.stop()`, run `openInEditor`, then `tui.start()` and `tui.requestRender(true)` in a `finally`;
  - **result**: run `createCharacterFromDraft` and show the report, the warnings, or the error (with the draft path) as notices. On success, add a hint: `Start chatting with /chat <id>`.
- [X] T007 [US2] Try T-g in `packages/tui/src/app-create.test.ts` with a fake `VISUAL`. Defer it if the harness needs more than about 60 lines

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 4 - Simple lore while creating (P3)

- [X] T008 [US4] Make sure the lorebook `###` blocks flow through to `character_book`, and that entries without keys that are not always on give the warning. Write test T-h: create a character with two entries, then `dryRun` it with a keyword message. The trace shows one entry `always on` and one entry fired by the keyword

**Checkpoint**: checks pass. Commit.

---

## Phase 4: Polish

- [ ] T009 Run `pnpm build && pnpm lint && pnpm test` and fix any failures
- [ ] T010 Run `speckit-converge` on this feature and complete any tasks it appends
- [ ] T011 Write `specs/007-character-creator/report.md` with the same sections as the earlier reports. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4. **Parallel**: T001, T002 and T003.
