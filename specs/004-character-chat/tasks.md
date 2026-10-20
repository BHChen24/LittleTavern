---
description: "Task list for 004-character-chat"
---

# Tasks: Character Chat

**Input**: Design documents from `specs/004-character-chat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/commands.md,
quickstart.md

**Tests**: from the spec's "Acceptance Testing" section and plan.md's Test Plan (T-a to T-h).

**Read before starting**:
- `research.md`, especially R1 (`generate` through `transformContext`) and R2 (the
  `SessionManager` calls, the record layout and the regenerate rules).
- 001's `chat-session.ts` and `app.ts`, 002's `library.ts`, and 003's `assembly/`.

## Rules for this run (unattended)

- **Stay on branch `004-character-chat`.** Never commit to `main`, and never switch, merge or
  rebase branches.
- **Do not stop to ask.** If something is unclear, write it to
  `specs/004-character-chat/questions.md`, take the most conservative option, and continue.
- **If a test is too complex to write**, record it under "Deferred tests" in the report and move
  on.
- **Never** read, print or use `.env`. **Never** run `pnpm test:live`. **Never** add a dependency.
- **Never** let pi write under `~/.pi`. Every `SessionManager` call passes
  `cwd = paths.dataDir` and `sessionDir = <dataDir>/sessions`.
- **Constitution V**: record your tool invocations and the run's platform-reported total tokens,
  or "unknown", in `specs/004-character-chat/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message, marking the finished tasks `[X]` in the same commit.
- **Keep it explainable.** pi imports are allowed only in `chat-session.ts`, `models.ts` and the
  new `character-chat.ts`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Extend `Settings` in `packages/data/src/settings.ts` with optional `userName` (non-empty string), `loreBudget` (number > 0), `scanDepth` (integer ≥ 0), `replyReserve` (number ≥ 0) and `lorebookAttachments` (record of string → string[]). Validate each field independently; an invalid field is dropped and the rest are kept. Change `writeSettings(paths, patch)` to merge `patch` into the existing file and keep unknown fields. Update 001's callers if the signature changes. Tests T-a in `settings.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 2: Foundational

- [X] T002 Add `ChatContext` (data-model.md) and `generate(context): Promise<TurnResult | null>` to `ChatSession` in `packages/engine/src/chat-session.ts`, following research R1:
  - map `system` to a `SystemMessage`, user messages to `UserMessage`s, and character messages to minimal `AssistantMessage`s (text content, the current model's api, provider and model, zero usage, `stopReason: "stop"`);
  - map `afterHistory` to a trailing `SystemMessage`;
  - clear `agent.state.messages` before the run, and have `transformContext` return the mapped list;
  - reuse the streaming, abort and `TurnResult` code from `send`.

  `send(text)` must keep working unchanged. Write tests T-b in `chat-session.test.ts`, using the simulated history callback to assert what the model received.
- [X] T003 Export `ChatContext` and the new method from `packages/engine/src/index.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 1 - Chat with an imported character (P1) 🎯 MVP

- [X] T004 [US1] Create `CharacterChat` in `packages/engine/src/character-chat.ts` with `start(...)`, `history()`, `send(text)`, `abort()`, `setModel(id)`, `isStreaming`, `lastTrace`, `sessionId`, `character` and `libraryId`, as listed in data-model.md.
  - **`start`**: writes `custom "littletavern.character" { libraryId, name }`, `appendSessionInfo(name)`, and `custom "littletavern.greeting" { text }` (the greeting with macros replaced; only written when the greeting is non-empty).
  - **`send`**: does the following, in order:
    1. Re-read the settings.
    2. Append the `UserMessage`.
    3. Build the history from `getBranch()`.
    4. Call `assemblePrompt` with:
       - `character`;
       - the attached lorebooks, resolved through `getItem`;
       - `userName`;
       - the history;
       - the model's `contextWindow`;
       - the settings.
    5. Store `lastTrace`.
    6. Call `ChatSession.generate` with the assembled prompt mapped to a `ChatContext`.
    7. Append an `AssistantMessage` built from the `TurnResult`:
       - completed: append it;
       - interrupted: append the partial text with `custom: { interrupted: true }`;
       - error: append nothing.

    It returns the `TurnResult`.
  - **Usage records**: they use `sessionId` (the pi session id).
- [X] T005 [US1] Write tests T-c and T-d in `packages/engine/src/character-chat.test.ts`, using a temporary `LITTLETAVERN_HOME`, a character imported with 002's `importFile` from a fixture card that has a lorebook, and the simulated model
- [ ] T006 [P] [US1] Create `packages/tui/src/components/character-picker.ts`, an overlay with an `Input` filter and a `SelectList` filtered by `fuzzyFilter`, following `model-picker.ts`. Each item shows the name and the id prefix. Enter emits the item, Esc cancels. If it duplicates more than about 30 lines of `model-picker.ts`, extract a small shared `ListPicker` instead (research R4)
- [ ] T007 [US1] In `packages/tui/src/app.ts`, add character mode:
  - **`/characters`** opens the picker; **`/chat <id>`** starts a chat directly (`getItem` by prefix; ambiguous or not found → notice).
  - **On start**: clear the transcript and render `history()`, so the greeting is the first character message.
  - **Status bar**: prefixed with the character name.
  - **Sending**: in character mode, messages go through `CharacterChat.send`. Esc, quit and ledger handling stay the same as in 001.
  - **`/plain`** returns to plain chat.
  - **Help**: add the commands to `APP_HELP`.

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 2 - Regenerate the last reply (P1)

- [X] T008 [US2] Add `regenerate()` to `CharacterChat`, following the research R2 regenerate rules. If the leaf is an assistant message, call `branch(parentId)` and then generate. If the leaf is a user message, generate directly. Otherwise return `"nothing-to-regenerate"`. Do nothing while streaming. Each generation writes its own usage record. Tests T-e in `character-chat.test.ts`
- [ ] T009 [US2] In `app.ts`, add `/regenerate` and Ctrl+R (in the input listener, next to Esc). Remove the last reply's component and stream the new one in its place. When the result is `"nothing-to-regenerate"`, show a notice. Without a character, show "Start a character chat first (/characters)."

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 3 - Chats are saved and can be resumed (P2)

- [X] T010 [US3] Add `listChats(paths)` and `CharacterChat.resume({ sessionPath, … })` to `character-chat.ts`.
  - **`listChats`** calls `SessionManager.list(dataDir, <dataDir>/sessions)` and returns the chat-list entries from data-model.md, newest first.
  - **`resume`** calls `SessionManager.open` and reads `littletavern.character`. If the character is no longer in the library, it throws or returns an error saying so. It ignores unknown entry types.

  Tests T-f.
- [ ] T011 [P] [US3] Create `packages/tui/src/components/session-picker.ts`, which lists the character name, last activity (local time) and message count, newest first. Enter resumes the selected chat and Esc cancels. Reuse the picker pattern or the `ListPicker`
- [ ] T012 [US3] In `app.ts`, add `/sessions`: open the picker, resume the selected chat, and rebuild the transcript from `history()`. Mark interrupted replies the same way 001 does

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 4 - Use standalone lorebooks with a character (P2)

- [X] T013 [US4] In `character-chat.ts`, add `attachLorebook(id)`, `detachLorebook(id)` and `activeLorebooks()`.
  - **Storage**: attachments live in the settings field `lorebookAttachments[libraryId]`, written through the merging `writeSettings`. Only lorebook items can be attached.
  - **Missing lorebooks**: `send` resolves the attachments on every request and skips any that are missing, emitting a one-time notice through an `onNotice` callback.
  - **Tests**: T-g.
- [ ] T014 [US4] In `app.ts`, add the commands `/attach <id>`, `/detach <id>` and `/lorebooks`, all with prefix lookup. `/lorebooks` lists the embedded lorebook first, then the attached ones, each with its name and entry count

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Polish

- [ ] T015 Try T-h in `packages/tui/src/app-character.test.ts` with 001's app test harness. If the harness grows beyond about 60 lines, delete the attempt and record T-h as deferred
- [ ] T016 Run `pnpm build && pnpm lint && pnpm test`. Fix any failures
- [ ] T017 Write `specs/004-character-chat/report.md` with the same sections as the earlier reports, including "Development tool and token usage". Commit

---

## Dependencies & Execution Order

The phases run in order: Setup → Foundational → US1 → US2 → US3 → US4 → Polish. Every story
edits `character-chat.ts` and `app.ts`, so run them sequentially.

**Parallel**: T006 can be written alongside T004 and T005. T011 can be written alongside T010.

## Implementation Strategy

1. **MVP** = Phases 1–3: roleplay with an imported card. This is the v1 goal.
2. **US2** adds regenerate, which the owner requires for v1.
3. **US3** makes chats survive restarts.
4. **US4** adds world books.
