---
description: "Task list for 014-innkeeper"
---

# Tasks: The Innkeeper

**Input**: Design documents from `specs/014-innkeeper/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md,
quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-f).

**Read before starting**:

- `research.md` R1–R10. Every fact there cites the pi or project line it was read from; follow
  those decisions. In particular:
  - R1: sequential tools, with confirmation inside `execute`;
  - R3: two agents in `ChatSession`;
  - R4: the tools and every pi type stay inside the engine's adapter modules (constitution II);
  - R6: the shallow-merge and malformed-file pitfalls;
  - R8: opening a chat after the run.
- `contracts/messages.md`: the prompt and every user-visible or model-visible text. Use the texts
  exactly.
- `data-model.md`: the setting keys, rules, backups, and the engine and app types.
- plan.md "Integration note: 013": 013 is already merged into this branch. Do not merge
  anything yourself, and keep 013's `/undo` and `/edit` code and tests working.
- The current code:
  - `packages/data/src/settings.ts`;
  - `packages/engine/src/chat-session.ts` (the whole file), `system-prompt.ts`, `index.ts`,
    `character-chat.ts` (`listChats`, `readChatCharacter`, `CharacterChat.resume`);
  - `../pi/packages/agent/src/types.ts` (`AgentTool`, `FinishTurn`, events) and
    `../pi/packages/ai/src/providers/faux.ts` (`fauxToolCall`, `fauxAssistantMessage`);
  - in `packages/tui/src/app.ts`: `createApp` (request building), `stream`, `onDelta`,
    `onFinish`, `allowSpend`, `openModelPicker`, `startChat`, `setCharacterChat`, the
    `innkeeper` and `new` handlers, `submit` and the input listener.

## Rules for this run (unattended)

- **Stay on branch `014-innkeeper`.** It reaches `main` only through a pull request that the owner
  merges (constitution 3.2.0).
  - Never commit to or push `main`, and never switch, merge or rebase branches.
  - **Never open, merge or close pull requests. Never push, tag or publish.**
  - Work in this worktree, `../LittleTavern-014`. Do not touch the main checkout.
- **Do not stop to ask, but do not invent behaviour.** There are two kinds of question:
  - an *implementation detail*: choose the simplest option that satisfies the spec, and note it
    in `specs/014-innkeeper/questions.md`;
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
  `specs/014-innkeeper/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message, and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (settings and the session)

- [X] T001 In `packages/data/src/settings.ts` (research R6, data-model.md):
  - move the validation rules into one table used by `readRequestSettings`, `readSettings` (lore fields and `mouse`) and a new exported `checkSettingChange(setting, value): string | null`. It returns the rule text for an invalid value, for a key not in the table, and for `null` on a non-removable key. The rules, verbatim from data-model.md: `limits.replyTokens` "whole number ≥ 0"; `limits.runSpendUsd` "number ≥ 0"; `limits.toolRounds` "whole number ≥ 1"; `generation.temperature` "number 0–2"; `generation.topP` "number 0–1"; `generation.topK` "whole number ≥ 1"; `generation.minP` "number 0–1"; `generation.repetitionPenalty` "number > 0"; `loreBudget` "number > 0"; `scanDepth` "whole number ≥ 0"; `replyReserve` "number ≥ 0"; `mouse` "true or false";
  - add `toolRounds` (default 5) to `RequestSettings` and `readRequestSettings`, with the 012 warning format;
  - add `updateSettings(paths, changes): { backupPath: string | null }` with the four steps in R6: a strict parse, a timestamped exclusive backup in `<configDir>/backups/`, nested set or delete, then the write.

  Keep `readSettings`'s and `readRequestSettings`'s existing behaviour and warnings unchanged. Export through the data barrel. Write T-a and T-b in `packages/data/src/settings.test.ts`
- [X] T002 In `packages/engine/src/innkeeper-tools.ts` (new) and `packages/engine/src/chat-session.ts` (research R1, R3, R4):
  - in `innkeeper-tools.ts`, define the LittleTavern types `InnkeeperToolContext` and `ConfirmRequest` exactly as in data-model.md, and `createInnkeeperTools(context): AgentTool[]` with only `get_help` for now (contract label; result `context.help()`). Export the two types from the engine barrel; do **not** export `createInnkeeperTools` or any pi type (constitution II);
  - add `innkeeper?: InnkeeperToolContext` and `toolRounds?: number` to `ChatSessionOptions`;
  - build a second `Agent` for the innkeeper from the same model registry and `streamFn`, with `tools: options.innkeeper ? createInnkeeperTools(options.innkeeper) : []`, `toolExecution: "sequential"`, and `systemPrompt: options.systemPrompt`;
  - its `finishTurn`: count turns with tool results in the current run; return `{ action: "end" }` and mark `toolLimitReached` when the count reaches `toolRounds` (option, default 5, settable), or when any tool result has `details.endTurn === true`;
  - `send()` and `clearConversation()` use the innkeeper agent; `generate()` uses the character agent (`tools: []`) and no longer saves and restores messages;
  - subscribe to both agents for deltas. Add `onToolCall(listener: (call: { name: string; label: string }) => void)`, fired on `tool_execution_start`, with the label from the tool definition;
  - `run()` sums `usage` (all token fields and every `cost` field) over every assistant `message_end` of the run; `TurnResult.usage` is the sum; add `toolLimitReached?: boolean`;
  - `isStreaming`, `abort()` and `setModel()` cover both agents;
  - add `setRequest(request)`;
  - add `innkeeperHistory(): InnkeeperHistoryItem[]` (R9);
  - extend `SimulatedReply` with `{ text?: string; toolCalls: { name: string; args: Record<string, unknown> }[] }`, built with `fauxText` and `fauxToolCall`.

  Write T-d in `packages/engine/src/chat-session.test.ts` with a stub context whose `help()` returns a fixed text, driving `get_help` through faux tool calls. The `details.endTurn` case is written in T007, once `open_chat` exists. Existing character-chat tests must pass unchanged

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - Ask the innkeeper how things work (Priority: P1)

**Goal**: the read-only tools and the prompt; the app shows the tool lines.

**Independent test**: a faux `get_help` call then an answer shows `· Innkeeper read the house
rules` before the answer, and the answer request contained the help text.

- [X] T003 [US1] In `packages/engine/src/innkeeper-tools.ts`, add `read_settings`, `list_characters` and `list_personas` exactly as research R5 describes, with the contract labels. `read_settings` takes `limits` and `generation` from `context.requestSettings()` (the values in use), the rest from the file; it builds its result field by field and never reads the credentials file. Add `INNKEEPER_SYSTEM_PROMPT` (contract text, verbatim) to `packages/engine/src/system-prompt.ts` and export it from the engine barrel. Write the read-only part of T-c in `packages/engine/src/innkeeper-tools.test.ts`, including a key in the credentials file and in the env that never appears in any result, and a hand-edited `limits.replyTokens` in the file that `read_settings` does not report while `requestSettings()` returns the old value
- [X] T004 [US1] In `packages/tui/src/app.ts` (research R4, R9):
  - build the `InnkeeperToolContext`: `help` = `helpText()` plus the import folders, the settings file path and the backups folder (`<configDir>/backups/`, spec FR-014); `requestSettings` returns the app's in-memory `requestSettings`; the other callbacks from T006 and T008 can start as stubs that the later tasks complete;
  - pass `innkeeper: context`, `toolRounds: requestSettings.toolRounds` and `INNKEEPER_SYSTEM_PROMPT` to the `ChatSession` it creates;
  - on `session.onToolCall`, remove the current reply view if it is still empty, add the muted line `· Innkeeper <label>`, and start a new empty reply view;
  - the `/innkeeper` handler renders `session.innkeeperHistory()` (tool items as muted lines) and then shows the contract notice;
  - update the `/innkeeper` description in `packages/tui/src/commands.ts`.

  Write the matching parts of T-e in a new `packages/tui/src/app-innkeeper.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 2 - Let the innkeeper change the hard settings (Priority: P1)

**Goal**: validated, confirmed, backed-up changes that apply at once.

**Independent test**: a faux `change_settings` call for `limits.replyTokens: 1000` shows the change
line and the picker; Yes writes the file and a backup, and the next character request asks for
1000 tokens; No writes nothing.

- [X] T005 [US2] Add `change_settings` to `packages/engine/src/innkeeper-tools.ts` (research R5, R6). Its schema is `{ changes: [{ setting: one of the data-model keys, value: number | boolean | null }] }`. It:
  1. validates every change with `checkSettingChange`; on the first failure, returns the contract error result and asks nothing;
  2. reads the old values;
  3. calls `context.confirm({ lines, title })` with the contract lines and title. On `false`, it returns `The guest declined.`;
  4. calls `updateSettings`. A malformed file returns the contract error result;
  5. calls `context.applied(changes, backupPath)` and returns the saved result.

  Write the `change_settings` part of T-c
- [X] T006 [US2] In `packages/tui/src/app.ts` (research R7, R9):
  - `confirm`: show the lines as a muted notice, open a `ListPicker` with `Yes` and `No` and the title, and set `confirming` while it is open. Esc or `onCancel` answers No. An abort of `signal` closes it and answers No. In the input listener, Esc does not abort while `confirming`;
  - move the request building into `buildRequest(requestSettings)`;
  - `applied(changes, backupPath)`: update `requestSettings` with only these changes; `session.setRequest(buildRequest(requestSettings))`; set `allowedSpend` when `runSpendUsd` changes; set `session.toolRounds` when it changes; show the contract saved notice (with `backupPath`, or the no-backup text when it is `null`) and, when `mouse` changed, the restart notice.

  Write the matching parts of T-e

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 3 - Open a chat from the innkeeper (Priority: P2)

**Goal**: a confirmed `open_chat` opens a new or resumed chat after the innkeeper's run.

**Independent test**: faux `open_chat` for Alice (new), Yes → after the run, the Alice chat is open
and the usage record of the run carries the innkeeper's session id.

- [X] T007 [US3] Add `open_chat` to `packages/engine/src/innkeeper-tools.ts` (research R5, R8). It resolves the character (an exact id or name, case-insensitive; else a unique substring; else the contract errors). For `"resume"`, it finds the newest chat whose `readChatCharacter` library id matches, or returns the no-saved-chat error. Then `context.confirm` with the contract title. Yes → `context.openChat(item, sessionPath?)` and the contract result with `details: { endTurn: true }`. Write the `open_chat` part of T-c, and the T-d case in `chat-session.test.ts` where an accepted `open_chat` ends the run with no further request
- [X] T008 [US3] In `packages/tui/src/app.ts`: `openChat` records `pendingOpen`. After `stream()` returns for an innkeeper send, if `pendingOpen` is set, clear it and call `startChat(item)` or `setCharacterChat(CharacterChat.resume({ paths, session, sessionPath }))`, with the existing error handling. Write the matching parts of T-e

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 4 - The innkeeper cannot run away with money (Priority: P1)

**Goal**: the round limit is visible; usage counts every request.

**Independent test**: with `limits.toolRounds` 1 and a faux reply list that keeps calling tools,
the turn stops with the contract notice; the status bar cost equals the summed usage.

- [X] T009 [US4] In `packages/tui/src/app.ts` `onFinish`: when `turn.toolLimitReached`, show the contract round-limit notice. Check that the usage record uses the summed usage from T002 and that the 012 spend question and innkeeper failure notice still apply to innkeeper sends. Write the matching parts of T-e

**Checkpoint**: checks pass. Commit.

---

## Phase 6: Happy path and docs

- [ ] T010 Write the happy path T-f in `packages/tui/src/app-innkeeper.test.ts`: a fresh home with the example Alice; `/innkeeper`; a faux `get_help` then an answer; a faux `change_settings` for `limits.replyTokens` 1000 → Yes → a backup in `<configDir>/backups/`; a faux `open_chat` for Alice → Yes → after the run, the Alice chat is open; a send there asks for 1000 output tokens (`simulated.onRequest`)
- [ ] T011 Check that help lists `/innkeeper` with the contract description and that `get_help`'s text names the backups folder (spec FR-014). Update `README.md`: what the innkeeper can look up and change, that every change asks first and is backed up to `<configDir>/backups/`, that changes apply immediately (`mouse` after a restart), and `limits.toolRounds` in the limits section. Update the `/innkeeper` row in the command table and in `specs/006-usability/contracts/commands.md` (note "changed by 014")

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Polish

- [ ] T012 Run `pnpm build && pnpm lint && pnpm test` and `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`. Fix any failures
- [ ] T013 Run `speckit-converge` on this feature and complete any appended tasks
- [ ] T014 Write `specs/014-innkeeper/report.md` with the same sections as `specs/012-chat-safeguards/report.md`. Include test results, deferred tests, and the owner's manual checks from `quickstart.md`. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7.

- T002 needs T001 (`RequestSettings.toolRounds` in the context type).
- T003 needs T002 (the tools module and the context).
- T005 needs T001 (`checkSettingChange`, `updateSettings`).
- US1 to US4 all edit `app.ts`, so they run in order.

## Implementation Strategy

US1 alone makes the innkeeper useful and safe (read-only). US2 is the owner's main ask: the
hard settings. US3 connects to character chats. US4 makes the money protection visible; its
mechanism is already in T002. The feature is complete only when all phases are done. If a run is
interrupted, leave the remaining tasks unchecked and say so in the report.
