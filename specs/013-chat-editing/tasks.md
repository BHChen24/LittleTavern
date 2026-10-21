---
description: "Task list for 013-chat-editing"
---

# Tasks: Chat Editing

**Input**: Design documents from `specs/013-chat-editing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md,
quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-h).

**Read before starting**:

- `research.md` R1–R6. Every fact there cites the pi or project line it was read from; follow
  those decisions. R1's invariant matters most: **the last entry in the session file is the last
  item the chat shows.**
- `contracts/messages.md`: every user-visible text. Use the texts exactly.
- `data-model.md`: what each operation appends, the engine methods and the editing state.
- The current code:
  - `packages/engine/src/character-chat.ts`: `historyFromEntries`, `history`, `send`,
    `regenerate`, `prev`, `regenerateTarget`, `generate`;
  - `packages/engine/src/character-chat.test.ts`: how sessions are reopened;
  - in `packages/tui/src/app.ts`: `renderHistory`, `regenerate`, `stream`, `allowSpend`,
    `interceptIncompleteSetup`, `submit` (with the `handlers` map) and the input listener;
  - `packages/tui/src/components/input-box.ts` and `list-picker.ts`;
  - `packages/tui/src/app-safeguards.test.ts` and `app-pickers.test.ts`: how app tests drive the
    app.

## Rules for this run (unattended)

- **Stay on branch `013-chat-editing`.** It reaches `main` only through a pull request that the
  owner merges (constitution 3.2.0).
  - Never commit to or push `main`, and never switch, merge or rebase branches.
  - **Never open, merge or close pull requests. Never push, tag or publish.**
  - Work in this worktree, `../LittleTavern-013`. Do not touch the main checkout.
- **Do not stop to ask, but do not invent behaviour.** There are two kinds of question:
  - an *implementation detail*: choose the simplest option that satisfies the spec, and note it
    in `specs/013-chat-editing/questions.md`;
  - *behaviour that the artifacts do not define*: do not decide it. Leave that task unchecked,
    record the question in `questions.md` for the owner, and continue with the other tasks.
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
  `specs/013-chat-editing/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message, and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (engine)

- [ ] T001 In `packages/engine/src/character-chat.ts`, add `entryId?: string` to `ChatHistoryItem` and set it in `historyFromEntries` for user and assistant message entries (`entry.id`). The greeting gets none (research R3). Add a private helper that returns the current branch's entry for an id only if it is a message with the expected role (`"user"` or `"assistant"`), and throws otherwise; `resendFrom` and `editReply` use it. Write T-a in `packages/engine/src/character-chat.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - Take back the last turn (Priority: P1)

**Goal**: `/undo` removes the last turn, returns the player's text, and the result survives a
restart.

**Independent test**: two turns, `/undo`, one turn on screen and in the next request, the text in
the input; reopening the file shows one turn.

- [ ] T002 [US1] In `packages/engine/src/character-chat.ts`, add `undo(): { text: string } | "nothing-to-undo"` exactly as research R2 describes:
  1. scan `getBranch()` backwards for the last user message; none → `"nothing-to-undo"`;
  2. `before` = the entry just before it on the branch;
  3. `branch(before.parentId)`, or `resetLeaf()` when `before.parentId` is null;
  4. append a copy of `before`: `appendMessage(before.message)` for a message entry, `appendCustomEntry(before.customType, before.data)` for a custom entry, `appendSessionInfo(before.name)` for a `session_info` entry (a card without a greeting); throw for any other entry type;
  5. clear `replaced`; return the user message's text (joined text blocks, as `historyFromEntries` does).

  Return `"nothing-to-undo"` while streaming. Do not change `regenerateTarget`, `regenerate` or `prev`. Write T-b with every case in plan.md, including the card without a greeting (undo the first turn, reopen with `CharacterChat.resume`, send again), the entry ids kept in the file, and the unchanged usage totals and `lastTrace`
- [ ] T003 [US1] Add `undo` to `COMMANDS()` in `packages/tui/src/commands.ts`, right after `prev`, with the contract description. In `packages/tui/src/app.ts`, add the handler (research R5):
  - no character chat: `/undo works in character chats.`;
  - `"nothing-to-undo"`: `There is nothing to undo.`;
  - otherwise `renderHistory(chat.history())` and `editor.setText(text)`.

  Add `/undo` to the streaming wait-message lists in `submit()` and in the input listener. Write T-e in a new `packages/tui/src/app-editing.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 2 - Edit a message and continue from it (Priority: P1)

**Goal**: `/edit` picks a message, the input edits it, and saving continues the chat from it.

**Independent test**: three turns; edit the player message of turn 2: the transcript and the
next request contain turn 1, the edited message and a new reply. Edit a reply: no request; the
reply shows the new text.

- [ ] T004 [US2] In `packages/engine/src/character-chat.ts` (research R3, data-model.md):
  - `resendFrom(entryId, text)`: return `null` while streaming; check that the entry is a user message on the current branch (T001 helper); `branch(entry.parentId)`; `return this.send(text)`;
  - `editReply(entryId, text)`: check that the entry is an assistant message on the current branch; `branch(entry.parentId)`; `appendMessage({ ...entry.message, content: [{ type: "text", text }], stopReason: "stop" })`; clear `replaced`.

  Write T-c and T-d with every case in plan.md, including the Ctrl+R retry after a failed resend, the next request after `editReply`, regenerate then `prev()` after `editReply`, the entry ids kept in the file, and the usage totals and `lastTrace`
- [ ] T005 [US2] In `packages/tui/src/components/input-box.ts`, add an optional `banner?: () => string | undefined` constructor argument. When it returns text, render it as one muted line (through `stripControls` and `truncateToWidth`) above the editor's lines; otherwise render as today. Extend `input-box.test.ts`
- [ ] T006 [US2] Add `edit` to `COMMANDS()` right after `undo`, with the contract description. In `packages/tui/src/app.ts` (research R4, R5; contract "/edit" and "Editing state"):
  - state `editing: { entryId: string; role: "user" | "character"; text: string } | null`;
  - keep the `CombinedAutocompleteProvider` created at `app.ts:241` in a variable, and add a module-level `NO_SUGGESTIONS: AutocompleteProvider` whose `getSuggestions` resolves `null` and whose `applyCompletion` returns `{ lines, cursorLine, cursorCol }` unchanged (research R4, spec FR-013). Whenever `editing` is set, call `editor.setAutocompleteProvider(NO_SUGGESTIONS)`; whenever it is cleared (save, Esc), put the normal provider back;
  - pass a banner callback to `InputBox` that returns the contract banner while `editing` is set;
  - the `/edit` handler: no character chat → contract message; history items with `entryId`, newest first; none → contract message; otherwise a `ListPicker` with the contract title and placeholder, label `You` or the character's name, description the first line of the text, search the full text. Selecting closes the picker, sets `editing` and calls `editor.setText(text)`;
  - add `/edit` to both streaming wait-message lists.
- [ ] T007 [US2] In `submit()` in `packages/tui/src/app.ts`, before the empty-text return and the command parsing, when `editing` is set:
  - empty text → the contract error; editing continues;
  - role `user`: `interceptIncompleteSetup(value)`, then `allowSpend(value)`; if either stops it, editing stays (the text is already back in the input). Otherwise clear `editing` and `retries`; render the history up to (not including) the edited item; `addMessage("user", display(value))`; `stream(() => chat.resendFrom(entryId, value))`;
  - role `character`: if `value` equals the original text trimmed → clear `editing`, `No changes.`, and nothing else (no engine call: later messages, an interrupted mark and `/prev` stay; spec FR-005 and edge cases); otherwise `chat.editReply(entryId, value)`, clear `editing`, `renderHistory(chat.history())`.

  In the input listener, while `editing` is set and the editor has focus:
  - Esc: clear `editing` (which restores the provider), `editor.setText("")`, show `Edit cancelled.`, consume. No menu can be open while editing (research R4);
  - Ctrl+R: show the contract message and consume, without regenerating.

  Ctrl+O and Ctrl+C keep their behaviour. Write T-f and T-g in `packages/tui/src/app-editing.test.ts`, with every case in plan.md

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 3 - Clear limits on where the commands work (Priority: P2)

**Goal**: the commands refuse cleanly outside character chats and while streaming; `/prev` is
cleared.

**Independent test**: covered by T-e, T-f and T-b to T-d. This phase checks that every
acceptance scenario of US3 has a test.

- [ ] T008 [US3] Check that the tests cover spec US3 scenarios 1–3 (innkeeper, no chat, streaming via `submit()` and via the input listener, `/prev` after undo, after `resendFrom` and after `editReply`). Add any missing case to `app-editing.test.ts` or `character-chat.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 5: Happy path and docs

- [ ] T009 Write the happy path T-h in `packages/tui/src/app-editing.test.ts`: a temporary home, a synthetic card with a greeting, send twice, `/undo`, change the text and send, `/edit` the first reply and save, then create a second app on the same home, resume the chat through the engine (`CharacterChat.resume`) or `/sessions`, and check that its transcript matches the first app's
- [ ] T010 Update `README.md`: `/undo` and `/edit` in the command table with the contract descriptions, and a short paragraph: undo puts your text back into the input; edit continues the chat from the edited message; earlier versions stay in the session file. Add `/undo` and `/edit` rows "(added by 013)" to `specs/006-usability/contracts/commands.md`. Help lists both through `COMMANDS()` (spec FR-012)

**Checkpoint**: checks pass. Commit.

---

## Phase 6: Polish

- [ ] T011 Run `pnpm build && pnpm lint && pnpm test` and `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`. Fix any failures
- [ ] T012 Run `speckit-converge` on this feature and complete any appended tasks
- [ ] T013 Write `specs/013-chat-editing/report.md` with the same sections as `specs/012-chat-safeguards/report.md`. Include test results, deferred tests, and the owner's manual checks from `quickstart.md`. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6.

- T001 is needed by T002 and T004 (`entryId` and the helper).
- T002 (engine) comes before T003 (TUI); T004 before T006 and T007.
- T005 is independent of T004 and can be written first.
- US1 and US2 both edit `app.ts`, so they run in order.

**Parallel**: T004 and T005 (different packages).

## Implementation Strategy

US1 is the smallest useful piece: undo plus resend covers the common typo. US2 adds editing any
message. US3 is mostly verification. The feature is complete only when all phases are done. If a
run is interrupted, leave the remaining tasks unchecked and say so in the report.
