---
description: "Task list for 011-tui-pickers"
---

# Tasks: Pickers Instead of Ids

**Input**: Design documents from `specs/011-tui-pickers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/commands.md,
quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-j).

**Read before starting**:

- `research.md` R1–R8. They hold every decision and the facts already checked against the code
  and pi `v1.3.0`.
- `contracts/commands.md`: the command list, every user-visible message and the frame layout. Use
  the texts exactly.
- `data-model.md`: the `/lorebooks` entries, their order and their states.
- The current `packages/tui/src/app.ts`, in particular:
  - `submit()` and its early return while streaming;
  - the `handlers` table and `changeLorebooks`;
  - the `/import` handler and `showImportReport`;
  - `openCharacterPicker` and `startChat`;
  - every `tui.showOverlay` call.
- Also read `packages/tui/src/commands.ts`, `packages/tui/src/components/list-picker.ts`,
  `packages/tui/src/components/file-browser.ts`, `packages/engine/src/character-chat.ts`
  (`attachLorebook`, `detachLorebook`, `activeLorebooks`) and `packages/engine/src/chat-session.ts`.

## Rules for this run (unattended)

- **Stay on branch `011-tui-pickers`.** It starts from `main` and reaches `main` only through a
  pull request that the owner merges (constitution 3.2.0).
  - Never commit to or push `main`, and never switch, merge or rebase branches.
  - **Never open, merge or close pull requests. Never push, tag or publish.**
- **Do not stop to ask, but do not invent behaviour.** There are two kinds of question:
  - an *implementation detail* (naming, structure, which API to call): choose the simplest option
    that satisfies the spec, and note it in `specs/011-tui-pickers/questions.md`;
  - *behaviour that the spec, plan, research or contract do not define*: do not decide it. Leave
    the affected task unchecked, record the question in `questions.md` for the owner, and continue
    with the other tasks.
- **Too complex tests**: record them under "Deferred tests" in the report.
- **Never**:
  - read, print or use `.env`;
  - run `pnpm test:live`;
  - add a dependency;
  - touch the real `~/.littletavern` or the real settings. Tests use temporary
    `LITTLETAVERN_HOME` folders;
  - launch a real editor;
  - bypass the git hooks with `--no-verify`;
  - edit `.gitleaksignore`. If gitleaks flags something, record it in `questions.md` and stop
    that task.
- **English only** (constitution 3.2.0).
- **Constitution V**: record tool calls and total tokens (or "unknown") in
  `specs/011-tui-pickers/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message, and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 (FR-011) In `.github/workflows/ci.yml`, change the trigger to `on: { push: { branches: [main] }, pull_request: {} }`, written in block YAML style like the rest of the file (research R7). Check that it parses with the `yaml` package (for example `node -e` run from `packages/data`) and that `push.branches` is `["main"]` and `pull_request` is present (T-j). Record the command and output for the report

**Checkpoint**: checks pass. Commit.

---

## Phase 2: Foundational

- [X] T002 [P] In `packages/engine/src/character-chat.ts`, add `attachedLorebookIds(): string[]`, which returns `readSettings(paths).lorebookAttachments?.[libraryId] ?? []` unchanged, including ids that no longer resolve (research R4). Export nothing new from the barrel unless the type is needed. Add a unit test next to the existing character-chat tests
- [X] T003 [P] In `packages/engine/src/chat-session.ts`, add `clearConversation(): void`, which sets the agent's messages to an empty list (`this.agent.state.messages = []`), the mechanism `generate()` already uses (research R6). Add a unit test with the faux provider: after one `send` and `clearConversation()`, the next request contains only the new user message
- [X] T004 In `packages/tui/src/app.ts`:
  - add `showPanel(component, options)` and route **every** `tui.showOverlay(...)` call through it. For now it calls `tui.showOverlay` unchanged; US4 adds the frame;
  - extract the `/import` selection logic into `importSelected(selected): ImportReport | null` (research R5): the realpath check against the import root, the existing "<name> is outside the import folders." message (`null`), the existing error handling, and otherwise `importFile`, the report notice, and the returned report;
  - `/import` uses `importSelected`, with unchanged behaviour. Existing `/import` tests must still pass (T-i)

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 1 - Inspect an item without knowing its id (Priority: P1)

**Goal**: `/show` is a searchable picker.

**Independent test**: `/show`, type part of a name, Enter: the item's details are shown.

- [X] T005 [US1] In `packages/tui/src/commands.ts`, give `show` no `argumentHint` and no `getArgumentCompletions`, with the description `Inspect a library item` (contract). In `packages/tui/src/app.ts`:
  - `/show` with no text opens a `ListPicker` (through `showPanel`) of every `listLibrary(paths)` item, using the contract's title and placeholder. Each entry has the label `stripControls(name)`, the description `<kind> · <id>` and the search text `<name> <id>` (data-model.md). Choosing an item closes the picker and shows `formatItemDetails(item)`;
  - an empty library shows `EMPTY_LIBRARY_HINT` and opens no picker;
  - `/show <anything>` shows `/show opens a picker. In a shell, run: littletavern show <id>` and looks nothing up. In the dispatch check, `show` joins `import` as a command that accepts trailing text (research R3).

  Write tests T-c (as listed in plan.md) and update the command tests (T-b, the `show` part) in `packages/tui/src/commands.test.ts` and the app tests

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 2 - Choose lorebooks for a character in one place (Priority: P1)

**Goal**: `/lorebooks` is the one place to attach, detach and import lorebooks.

**Independent test**: in a chat with one attached, one unattached and one embedded lorebook,
`/lorebooks` lists them with their states; choosing the unattached one attaches it.

- [X] T006 [US2] In `packages/tui/src/app.ts`, replace `changeLorebooks` and the `/lorebooks` listing with a picker (contract, data-model.md, research R4):
  - no character chat gives the existing `Start a character chat first (/characters).`;
  - the entries, in this order:
    1. `Import a lorebook…`;
    2. the card's embedded lorebook, if any, described `part of the card`;
    3. every library lorebook, described `attached` or `not attached` by membership in `chat.attachedLorebookIds()`;
    4. every attached id without a library lorebook, labelled with the id and described `attached, missing from the library`;
  - the picker closes after each choice (research R2);
  - choosing a library lorebook calls `chat.attachLorebook(item.id)` or `chat.detachLorebook(item.id)` and shows `Attached <name>.` or `Detached <name>.`;
  - choosing the card lorebook shows `<name> is part of the character card and cannot be detached.` and changes nothing;
  - choosing a missing entry detaches it with `Detached a lorebook that is no longer in the library.`;
  - names go through `stripControls`.
- [X] T007 [US2] In `packages/tui/src/app.ts`, implement the import entry (research R5):
  - open `new FileBrowser(paths.importLorebooksDir, paths.importRoot)` through `showPanel`;
  - on selection, call `importSelected`;
  - only if the report is ok and its item is a lorebook, call `chat.attachLorebook(report.item.id)` and show `Attached <name>.`;
  - any other result attaches nothing.
- [X] T008 [US2] Remove `attach` and `detach` from `COMMANDS()` in `packages/tui/src/commands.ts` and from the handler table. Set the `lorebooks` description to `Choose or import lorebooks for the current character`. Delete the now-unused `/detach` completion code. Write tests T-d and T-e with every case listed for them in plan.md (including the library with no lorebooks, the already-imported lorebook and the damaged file), and update existing tests that used `/attach` or `/detach` to use the `/lorebooks` picker

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 3 - Start a new chat without ids (Priority: P1)

**Goal**: `/new` starts over; `/chat` is gone.

**Independent test**: after one exchange, `/new` shows only the greeting, the next request has no
earlier history, and `/sessions` lists both chats.

- [X] T009 [US3] Add `new` to `COMMANDS()` with the description `Start a new chat with the current character`, and a handler in `packages/tui/src/app.ts` (research R6, contract):
  - in a character chat, look up `getItem(paths, chat.libraryId)`:
    - if it is missing or not a character, show `<name> is no longer in the library. Choose a character with /characters.`;
    - otherwise call `startChat(item)` and show `Started a new chat with <name>. Earlier chats are in /sessions.`;
  - in innkeeper mode, call `session.clearConversation()`, clear the transcript, and show `Started a new conversation with the innkeeper.`;
  - otherwise show `Choose a character with /characters, or use /innkeeper.`;
  - in `submit()`, before the early return for `session.isStreaming`: if the trimmed text is `/new`, show `Wait for the reply, or press Esc to stop it.` and leave the editor text as it is. Other input keeps today's behaviour.
- [X] T010 [US3] Remove `chat` from `COMMANDS()` and its handler. Write tests T-f with every case listed in plan.md (including `/new` in a resumed chat) and T-g (`/chat x`, `/attach x` and `/detach x` give `Unknown command. Use /help.`), and update existing tests that used `/chat <id>` to use the character picker or `startChat`
- [X] T011 [US3] Write the happy path T-h in `packages/tui/src/app-pickers.test.ts`, using the faux provider and code-generated synthetic cards and lorebooks, as the existing app tests do:
  1. start a chat;
  2. attach the lorebook through the `/lorebooks` picker;
  3. send a message whose keyword fires an entry, and check that `lastTrace` includes it;
  4. `/new`;
  5. send again, and check that the request contains the greeting and only the new user message

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 4 - Overlays look like panels (Priority: P2)

**Goal**: every overlay is framed.

**Independent test**: render any overlay and see the box border; checked visually by the owner.

- [X] T012 [P] [US4] Export the editor's border style from `packages/tui/src/theme.ts` (for example `frameBorder`, the same `dim` used by `editorTheme.borderColor`). Create `packages/tui/src/components/frame.ts` with `Frame` per research R1 and the contract:
  - it wraps one child;
  - it renders `┌`, `─` and `┐`, then `│ <line padded to width-4> │` for each child line rendered at `width - 4`, then `└`, `─` and `┘`;
  - it truncates lines with pi-tui `truncateToWidth` and measures them with `visibleWidth`;
  - it forwards `handleInput`, `invalidate` and the `focused` getter and setter.

  A long `ListPicker` title wraps inside the frame (pi-tui `Text` wraps it); do not add title truncation. Write T-a, including the long-title case, in `packages/tui/src/components/frame.test.ts`
- [X] T013 [US4] Make `showPanel` in `packages/tui/src/app.ts` wrap the component in a `Frame`. Check that the Esc and help-closing paths, the overlay focus and the trace overlay's height still work (the trace computes its height from the terminal rows; leave room for the two border rows). Adjust any app test that asserts exact overlay lines

**Checkpoint**: checks pass. Commit.

---

## Phase 7: User Story 5 - Help and docs match the commands (Priority: P3)

- [X] T014 [US5] Update `README.md`'s command table (research R8):
  - remove `/chat <id>` and `/attach <id>`, `/detach <id>`;
  - add `/new`;
  - `/lorebooks` becomes "Choose, attach or import lorebooks for the current character";
  - `/library`, `/show` becomes "List the library, or pick an item to inspect".

  Update `specs/006-usability/contracts/commands.md` exactly as research R8 lists: remove the `/chat <id>`, `/attach <id>` and `/detach <id>` rows from the active table; rewrite the `/lorebooks` and `/show` rows "(changed by 011)"; add a `/new` row "(added by 011)"; add the "removed by 011" note under the table. Then run `grep -rn "/chat <\|/attach\|/detach\|/show <" packages/tui/src README.md specs/006-usability/contracts/commands.md | grep -v "\.test\." | grep -v "removed by 011"`: it must print nothing

**Checkpoint**: checks pass. Commit.

---

## Phase 8: Polish

- [X] T015 Run `pnpm build && pnpm lint && pnpm test`, then `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`. Fix any failures. (The script's guided step 12 still mentions `/chat` and `/attach`; it is outside the repository and is updated by the owner's side, not here)
- [X] T016 Run `speckit-converge` on this feature and complete any appended tasks
- [X] T017 Write `specs/011-tui-pickers/report.md` with the same sections as `specs/010-release/report.md`. Include the test results, the T-j output, deferred tests, the owner's manual checks from `quickstart.md`, and the note that 0.1.1 is released by the owner after merge. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

- Phase 2 (`showPanel`, `importSelected` and the two engine methods) is needed by US1–US4.
- US1, US2 and US3 each edit `commands.ts` and `app.ts`, so they run in order, not in parallel.
- T011 (happy path) needs US2 and US3.
- US4 only changes `showPanel` and adds `Frame`, so every picker added earlier is framed at once.
- US5 describes US1–US3.

**Parallel**: T002 and T003; T012 alongside other work in a different file.

## Implementation Strategy

US1–US3 remove the ids; US4 changes only the look; US5 brings the docs in line. The feature is
complete only when all phases are done. If a run is interrupted, leave the remaining tasks
unchecked and say so in the report; do not present a partial run as delivered.

## Phase 9: Convergence

- [X] T018 Resolve owner design question Q1 in `specs/011-tui-pickers/questions.md` before completing T009: reconcile FR-007, SC-003 and US3/AC1 with pi's deferred persistence of greeting-only chats (`partial`, HIGH). Once the owner specifies whether these chats must be saved and updates the affected design, implement that decision in `packages/engine/src/character-chat.ts` and add a synthetic regression test in `packages/tui/src/app-pickers.test.ts`. Do not invent a session-storage policy or rewrite the spec during implementation. **Owner decision (2026-10-20)**: greeting-only chats are not saved, as pi already does, so **no engine change**. Complete T009 as written. Add tests for spec US3 scenarios 1 and 2: a chat with a message is kept and listed after `/new`; a greeting-only chat is replaced and not listed. Then mark T009 and T018
- [X] T019 Resolve owner design question Q2 in `specs/011-tui-pickers/questions.md`: specify how a panel taller than the terminal keeps all borders visible per FR-008 and US4/AC1 (`partial`, MEDIUM). A real renderer check at 60 columns and 24 rows renders help at 32 rows and omits the bottom border. Once the owner specifies clipping, scrolling or another overflow policy, implement it in the planned overlay/frame touchpoints and add a terminal-harness regression check; do not silently choose new overflow behavior. **Owner decision (2026-10-20)**, per research R1 "Height" and the contract's frame section: `/help` uses `TraceOverlay` with `wrapTextWithAnsi`-wrapped `helpText()` lines and height `max(3, rows - 8)`, closed by Esc through `onClose`, which replaces the `helpOpen` Esc path. `Frame` gets an optional maximum height; content that does not fit is cut, with `…` as the last visible line, and `showPanel` passes `() => tui.terminal.rows`. Tests: a `Frame` unit test of clipping with `…` and a complete border; an app test that `/help` at 60×24 renders a complete border and scrolls

## Phase 10: Convergence

- [X] T020 Correct manual quickstart step 4 in `specs/011-tui-pickers/quickstart.md` per FR-007, SC-003, US3/AC1–AC2 and the owner decision in T018 (`partial`, MEDIUM): after `/new`, `/sessions` lists the previous chat with messages; the new greeting-only chat is listed only after sending it a message. Make the validation sequence match that behavior without changing application code or storage policy
