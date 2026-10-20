---
description: "Task list for 009-ui-polish"
---

# Tasks: UI Polish

**Input**: Design documents from `specs/009-ui-polish/`

**Prerequisites**: plan.md, spec.md, research.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-k, with T-i split into T-i1 and T-i2).

**Read before starting**:

- `research.md` R1–R7. R1 points to pi coding-agent's full-screen setup in
  `../pi/packages/coding-agent/src/modes/interactive/tui-renderer.ts`, the model to follow.
- The current `app.ts`, which includes 008's `/persona`.

## Before you start (owner or design side)

This branch must contain 008's **finished** code. If `git merge-base --is-ancestor 008-persona HEAD`
fails, stop and report it in `questions.md`. Do not rebase yourself.

## Rules for this run (unattended)

- **Stay on branch `009-ui-polish`.** Never commit to `main`, and never switch, merge or rebase
  branches.
- **Do not stop to ask, but do not invent behaviour.** Two kinds of question:
  - an *implementation detail* (naming, structure, which pi call to use): choose the simplest
    option that satisfies the spec, and note it in `specs/009-ui-polish/questions.md`;
  - *behaviour the spec, plan or research do not define*: do not decide it. Leave the affected
    task unchecked, record the question for the owner, and continue with the other tasks.
- **Too complex tests**: record them under "Deferred tests" in the report.
- **Never**:
  - read, print or use `.env`;
  - run `pnpm test:live`;
  - add a dependency;
  - touch the real `~/.littletavern`;
  - launch a real editor in tests.
- **English only** (constitution 3.1.0). The logo is original ASCII art.
- **Constitution V**: record tool calls and total tokens (or "unknown") in
  `specs/009-ui-polish/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, commit with an English
  conventional message, and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [X] T001 [P] Rework `packages/tui/src/theme.ts` into named styles with the palette in research R3: `user`, `character`, `notice`, `error`, `dialogue`, `accent`, `muted`. Under a non-empty `NO_COLOR`, remove colours only and keep `bold`, `italic` and `dim` (R3 explains why plain `styleText` is not enough). Write tests T-i1
- [X] T002 [P] Add `colourDialogue(text)` in `packages/tui/src/dialogue.ts` (R3). Write tests T-a
- [X] T003 [P] Add `mouse?: boolean` to `Settings` in `packages/data/src/settings.ts`. It is validated as a boolean, and absent means `true`. Extend `settings.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - Full-screen app (P1)

- [X] T004 [US1] In `app.ts`, replace `TuiMainScreen` with `TuiAltScreen` per R1:
  - pass `mouse: settings.mouse !== false`, `copyOnSelect: true`, and `copySelection: copyText`, a new engine adapter `packages/engine/src/clipboard.ts` over pi coding-agent's exported `copyToClipboard` (R1; **not** `getNativeClipboard()`). Export it through the engine barrel, with one unit test of the success and error results using an injected copy function;
  - put the transcript inside the primary scroll view and keep the input and status outside it, following pi coding-agent's `tui-renderer.ts`;
  - keep `tui.stop()` on every exit path;
  - add the search key (`ctrl+shift+f`) and the scroll keys to `helpText()`.

  Update the test stub terminals if `TuiAltScreen` needs extra methods. Record the manual check (T-j) in the report.

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Stories 2, 3 - Logo and messages (P1)

- [X] T005 [P] [US2] Add the logo and the narrow-terminal fallback to `components/home-screen.ts` (R2). Write tests T-c
- [X] T006 [P] [US3] Create `components/message-view.ts`: label, bar, body, maximum width 100 (R3, R7b). Write tests T-b
- [X] T007 [US3] In `app.ts`:
  - render every message, including resumed history, with `MessageView`;
  - pass message text through `stripControls`, then `colourDialogue`, then Markdown;
  - add `notice(text, { kind: "error" })`, and use it for provider errors and failed commands.

  Write tests T-f.

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Stories 4, 5, 6 - Waiting, placeholder, key first (P1)

- [X] T008 [US4] Add the `Loader` waiting indicator in `app.ts` (R4). Write tests T-g with a simulated reply that waits before answering
- [X] T009 [P] [US5] Create `components/input-box.ts` (R5) and use it in `app.ts`, with the three placeholders. Write tests T-d
- [X] T010 [US6] Status bar (R6, R7a):
  - with no key, show `No API key — /apikey` and no model;
  - split the status into a top line (character, persona, model) and a bottom line (tokens, cache, cost), keeping 007's narrow fallback;
  - the persona field is `Persona: <name>` from 008's `readActivePersona`, added to `StatusInfo` as `persona?: string`; with no persona, or when the active one falls back, the field is omitted, the same way `character` is omitted outside a chat. It updates after `/persona` changes the selection;
  - after a successful `/apikey`, open the `ModelPicker` with the current model preselected.

  Write tests T-e and T-h, and then, now that messages and the status exist, T-i2 (rendered `NO_COLOR`) and T-k (tiny terminal).

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 7 - Optional refinements (P3)

- [X] T011 [US7] Bind **Ctrl+O** in `app.ts` to open the current input text in `$EDITOR` through 007's `openInEditor`, wrapped in `tui.stop()`/`tui.start()`, and put the edited text back into the input. Add it to `helpText()`. Test it with a fake `VISUAL`
- [X] T012 [US7] Light/dark palette via `TUI.queryTerminalColors()`, **only if it takes little time**. Otherwise record it as deferred in the report

**Checkpoint**: checks pass. Commit.

---

## Phase 6: Polish

- [X] T013 Run `pnpm build && pnpm lint && pnpm test`, then `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`, so that it tests this checkout's build. Fix any failures
- [X] T014 Run `speckit-converge` on this feature and complete any appended tasks
- [X] T015 Write `specs/009-ui-polish/report.md` with the same sections as the earlier reports. Include the manual full-screen checks for the owner (T-j): wheel, selection and copy, resizing, a terminal smaller than 40 columns and 10 rows, and the terminal restored on Ctrl+C, `/quit` and an error. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6. **Parallel**: T001, T002, T003; T005 and T006; T009 alongside T008.
