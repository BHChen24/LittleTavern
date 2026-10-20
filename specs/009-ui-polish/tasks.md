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

## Phase 7: Owner acceptance feedback (FR-011 to FR-013)

Added by the design side after the owner's first look on 2026-10-20. The rules for this run still
apply. Work in the checkout you were started in, on branch `009-ui-polish`.

- [X] T016 [P] Home screen (FR-011), in `components/home-screen.ts`:
  - replace `LOGO` with exactly these four lines (original artwork):

    ```text
      l i t t l e
    ▀▀█▀▀ ▄▀▀▀▄ █   █ █▀▀▀▀ █▀▀▀▄ █▄  █
      █   █▀▀▀█ ▀▄ ▄▀ █▀▀▀  █▀▀▀▄ █ ▀▄█
      ▀   ▀   ▀   ▀   ▀▀▀▀▀ ▀   ▀ ▀   ▀
    ```

  - render it **left-aligned** (no centring padding), in the accent style, when `width >= LOGO_WIDTH`;
  - replace the `LittleTavern <version>` line with `v<version> · Terminal roleplay with character cards and lorebooks`;
  - the narrow fallback (no logo) shows `LittleTavern` in the accent style, then that same line, so the name still appears once.

  Update `home-screen.test.ts`: the logo is left-aligned, its three letter rows have equal width, the name is not repeated, and the narrow fallback shows it once.
- [X] T017 [US1] Enter on the home screen (FR-012): `enterChat` opens the chat layout and then `openCharacterPicker()`. Esc closes the picker and leaves plain chat as today. Do not change plain chat or `/plain`. Update the app tests that press Enter and expect plain chat to close the picker first.
- [X] T018 [US1] "New character" in the character picker (FR-013):
  - in `openCharacterPicker`, add a first entry `New character` (searchable as "New character") that closes the picker and calls the existing `newCharacter()`, which already offers draft continuation; with an empty library it is the only entry;
  - remove `new-character` from `COMMANDS` in `commands.ts`, from the handlers in `app.ts` and from `helpText()`;
  - update `commands.test.ts`, `app-create.test.ts` and `app-persona.test.ts` to start creation from `/characters` → "New character";
  - in `specs/006-usability/contracts/commands.md`, remove the `/new-character` row and note "moved into `/characters` by 009" under the table.
- [X] T020 [US3] Rename plain chat to the innkeeper (FR-014), **user-facing text only** in `packages/tui`:
  - the command `plain` becomes `innkeeper` in `COMMANDS` (description "Talk to the innkeeper"), the handlers and `helpText()`;
  - the no-character speaker label and waiting text use `Innkeeper` instead of `Assistant` (`app.ts`, the `chat?.character.name ?? "Assistant"` fallbacks);
  - the placeholder `Talk… (/ for commands)` becomes `Talk to the innkeeper… (/ for commands)`;
  - the notice becomes `You are talking to the innkeeper. Use /characters to start a character chat.`;
  - in `specs/006-usability/contracts/commands.md`, rename the `/plain` row and note "renamed by 009".

  Do not change the plain-chat system prompt or engine internals (`ChatSession` keeps its names). Update the affected tests.
- [X] T019 Run the full gate and `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`, then add a "Phase 7" section to `report.md` (what changed, test results) and the manual checks: the logo at full and narrow width, Enter opening the picker, creating a character from it, and Esc then `/innkeeper` showing the Innkeeper. Commit. (T020 is listed before T019 because it was added later; do T019 last)

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7. **Parallel**: T001, T002, T003; T005 and T006; T009 alongside T008; T016 alongside T017–T018 (T017, T018 and T020 all edit `app.ts`, so do them in order). T019 is last.

## Phase 8: Explicit chat setup (owner follow-up)

Requested directly by the owner after Phase 7 (spec FR-012 and FR-015). These instructions supersede T017 and the
old automatic-picker/default-innkeeper startup behavior. Keep existing creation and key flows.

- [X] T021 Open only the chat layout on home Enter, keeping the editor focused and no picker open.
- [X] T022 Block all LLM requests, including regenerate and Ctrl+R, until a model is selected,
  an API key is supplied, and a character is selected/resumed or `/innkeeper` is explicitly used.
  Show the missing setup steps explicitly and preserve blocked input; setup and offline commands
  remain available. A valid saved model and an environment or saved API key count as configured;
  a character or Innkeeper must be selected in the current run (owner-confirmed).
- [X] T023 Update lightweight app regression tests for the setup gate, cancellation and both chat modes.
  Run build/lint/tests and external offline acceptance; record results, manual checks and usage; commit.
