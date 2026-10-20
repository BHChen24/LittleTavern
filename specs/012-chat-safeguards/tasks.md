---
description: "Task list for 012-chat-safeguards"
---

# Tasks: Chat Safeguards

**Input**: Design documents from `specs/012-chat-safeguards/`

**Prerequisites**: plan.md, spec.md (including "Plan-time corrections"), research.md,
data-model.md, contracts/messages.md, quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-k).

**Read before starting**:

- `research.md` R1–R11. Every fact there cites the pi or project line it was read from; follow
  those decisions.
- `contracts/messages.md`: every user-visible text. Use the texts exactly.
- `data-model.md`: the settings fields and ranges, the run state and the transitions.
- Spec "Plan-time corrections": the innkeeper retry hint, "prices unknown", the "Traveler"
  fallback, `/prev` appending a copy.
- The current code:
  - `packages/engine/src/chat-session.ts`: the Agent constructor, `run()` and the simulated
    provider;
  - `packages/engine/src/character-chat.ts`: `send`, `regenerate`, `regenerateTarget`,
    `generate` and `history`;
  - `packages/engine/src/usage.ts`;
  - `packages/data/src/settings.ts`;
  - in `packages/tui/src/app.ts`: `createApp` (session creation), `enterChat`, `setupSteps`,
    `updateSetupNotice`, `regenerate`, `stream`, `onFinish`, `submit` and the input listener;
  - `packages/tui/src/components/home-screen.ts` and `packages/tui/src/trace-format.ts`.

## Rules for this run (unattended)

- **Stay on branch `012-chat-safeguards`.** It reaches `main` only through a pull request that the
  owner merges (constitution 3.2.0).
  - Never commit to or push `main`, and never switch, merge or rebase branches.
  - **Never open, merge or close pull requests. Never push, tag or publish.**
  - Work in this worktree, `../LittleTavern-012`. Do not touch the main checkout.
- **Do not stop to ask, but do not invent behaviour.** There are two kinds of question:
  - an *implementation detail*: choose the simplest option that satisfies the spec, and note it
    in `specs/012-chat-safeguards/questions.md`;
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
  `specs/012-chat-safeguards/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message, and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (settings and request plumbing)

- [ ] T001 [P] In `packages/data/src/settings.ts`, add `readRequestSettings(paths)` returning `{ replyTokens, runSpendUsd, generation, warnings }` per research R9 and data-model.md. The ranges, verbatim:
  - `limits.replyTokens`: "whole number ≥ 0", default 4096;
  - `limits.runSpendUsd`: "number ≥ 0", default 1;
  - `temperature`: "number 0–2";
  - `topP`: "number 0–1";
  - `topK`: "whole number ≥ 1";
  - `minP`: "number 0–1";
  - `repetitionPenalty`: "number > 0".

  Each invalid value is dropped (a limit uses its default) and adds `Ignored <field> in settings.json: <rule>.` (contract). Export it through the data barrel, and through the engine re-exports if the TUI needs it. Write T-a in `packages/data/src/settings.test.ts`
- [ ] T002 [P] In `packages/engine/src/chat-session.ts` (research R1, R2):
  - add `request?: { maxTokens?: number; temperature?: number; samplingParams?: Record<string, number> }` to `ChatSessionOptions`;
  - wrap `streamFn` so the options passed to pi are `{ ...options, ...request }`;
  - add `get request()`;
  - add `cutOff: boolean` to `TurnResult`: true when the final message's `stopReason === "length"`; the outcome stays `"completed"`;
  - add an optional `simulated.onRequest?: (options) => void` hook, called from the faux response factory, which receives the options (`../pi/packages/ai/src/providers/faux.ts:109–114`).

  Write T-b and T-c in `packages/engine/src/chat-session.test.ts`. Add a way for the simulated provider to return a `stopReason: "length"` reply, for example a reply object `{ text, stopReason: "length" }`, mirroring the existing error reply
- [ ] T003 In `packages/engine`:
  - set `DEFAULT_USER_NAME` to `"Traveler"` in `src/assembly/types.ts` (R8), and update tests that expected "User";
  - in assembly, reserve `max(replyReserve, replyTokens)` when `replyTokens > 0` (R10). Pass `replyTokens` from `CharacterChat` to assembly through its settings input (`readRequestSettings`).

  Write T-j next to the existing assembly tests
- [ ] T004 In `packages/tui/src/app.ts` `createApp`, when it creates the `ChatSession` (no `options.session` given), pass `request` built from `readRequestSettings(paths)`:
  - `maxTokens` when `replyTokens > 0`;
  - `temperature` when set;
  - `samplingParams` with `top_p`, `top_k`, `min_p` and `repetition_penalty` for the set values (R1).

  Add the settings warnings to the startup notices, shown once like the others

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - A failed reply explains what to do (Priority: P1)

**Goal**: short failure notices, details in the log, a visible incomplete marker and a retry
count.

**Independent test**: a faux failure mid-reply shows the marker and the `other` notice with
`Retries so far: 0` and the log path; a failed Ctrl+R shows 1; a success resets it.

- [ ] T005 [US1] In `packages/tui/src/app.ts` `onFinish` and `regenerate` (research R5, contract "Failure notices"):
  - replace the current error notice with the contract text for each `describeProviderError` kind, ending with `Details: <paths.logFile>`. Keep the existing key-rejected behaviour of clearing the active key;
  - set the reply text to `<partial> (incomplete, not saved)`;
  - track `retries` as in data-model.md: a regenerate whose target is `"user"` right after a failure counts as a retry;
  - only the retryable kinds show the count (spec FR-003);
  - the innkeeper variant: `Send your message again to retry.`, with no count;
  - log `logger.error({ error, model, kind }, "Provider request failed")`.

  Write T-e in a new `packages/tui/src/app-safeguards.test.ts` with every case in plan.md, including its edge cases, using the simulated provider's error replies

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 2 - Spending stays within limits (Priority: P1)

**Goal**: the reply cap, the run cap prompt, the notes and the reminder line.

**Independent test**: with `runSpendUsd` tiny and a priced faux model, the second send asks;
`Stop` keeps the text; `Continue` sends.

- [ ] T006 [US2] Add `formatLimits(replyTokens, runSpendUsd, settingsFile)` in `packages/tui/src/library-format.ts` (or a new small module next to it), producing the contract's reminder line. Show it:
  - on the home screen, under the key status (`HomeScreen` option, research R11);
  - appended to the pre-chat setup notice while `!chat && !innkeeperSelected`.
- [ ] T007 [US2] In `packages/tui/src/app.ts`, before a character-chat send, a regenerate (including Ctrl+R) and an innkeeper send, check `runSpendUsd > 0 && sumUsage(records).cost >= allowedSpend` (research R3, R4). If so, open a `ListPicker` with the contract title and the `Continue` and `Stop` entries:
  - `Continue` adds `runSpendUsd` to `allowedSpend` and proceeds;
  - `Stop` restores the editor text and shows the contract message.
- [ ] T008 [US2] In `onFinish`:
  - after a turn with `cutOff`, show the cut-off note once per run;
  - before the first send with a model whose `findAllowedModel(model)?.price` is null or zero, show the unknown-price note once per run (research R3).

  Write T-f in `packages/tui/src/app-safeguards.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 3 - Bring back the previous reply (Priority: P2)

**Goal**: `/prev` swaps the last replaced reply back and forth, and the choice persists.

**Independent test**: A, regenerate to B, `/prev` shows A, the next request has A, and `/prev`
again shows B.

- [ ] T009 [US3] In `packages/engine/src/character-chat.ts`, add `replaced` and `prev(): "restored" | "nothing-to-restore"` exactly as research R6 describes:
  - clear it in `send()` and at the start of `regenerate()`;
  - set it to the replaced reply only when that regenerate completes or is interrupted; a failed regenerate leaves it cleared (spec FR-010);
  - `prev()` branches from the leaf's parent and appends a copy of `replaced`, then keeps the swapped-out reply as `replaced`.

  Write T-d in `packages/engine/src/character-chat.test.ts` with every case in plan.md, including the failed regenerate and reopening the session file
- [ ] T010 [US3] Add `prev` to `COMMANDS()` in `packages/tui/src/commands.ts` with the contract description, and a handler in `packages/tui/src/app.ts`:
  - not in a character chat: the contract message;
  - `"nothing-to-restore"`: the contract message;
  - `"restored"`: re-render the history.

  In the input listener, while `session.isStreaming`, an Enter whose trimmed editor text is `/new` or `/prev` shows `Wait for the reply, or press Esc to stop it.` and is consumed (research R7). Write T-g

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 4 - The player has a name (Priority: P2)

**Goal**: one name prompt; "User" never appears.

**Independent test**: a fresh home shows the prompt with `Traveler`; Enter saves it; a restart
does not ask again.

- [ ] T011 [US4] Create `packages/tui/src/components/name-prompt.ts`, a pi-tui `Input` prefilled with `Traveler` and titled as in the contract, forwarding `focused`. In `enterChat()` (`packages/tui/src/app.ts`), open it through `showPanel` before the setup notice when `readSettings(paths).userName` is absent and `readActivePersona(paths).persona` is null (research R8; a missing or invalid persona file counts as none):
  - Enter: clean the text with `stripControls` and trim it. An empty result shows `Please enter a name.` and keeps the prompt open. Otherwise `writeSettings(paths, { userName })` and show the saved message.
  - Esc: close and save nothing.

  Write T-h

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 5 - Tune the model's sampling (Priority: P3)

**Goal**: `/trace` shows what was sent. The settings and the sending are already done in
Phase 1.

**Independent test**: with `generation.temperature` set, `/trace` shows it on the request line.

- [ ] T012 [US5] Add `request?` to `AssemblyTrace` and set it from `session.request` in `CharacterChat.generate()` (research R9). In `packages/tui/src/trace-format.ts`, add the contract's `Requested:` line after the header (it reports what LittleTavern requested; research R9). Write T-i in the existing trace-format tests

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Happy path and docs

- [ ] T013 Write the happy path T-k in `packages/tui/src/app-safeguards.test.ts`:
  1. a fresh temporary home;
  2. the name prompt → "Mira";
  3. a synthetic card whose greeting uses `{{user}}`;
  4. send, regenerate, `/prev`;
  5. check that the next request (captured with `simulated.onRequest` or the faux context) contains the restored reply and "Mira", and that `/trace` shows the request line.
- [ ] T014 Update `README.md`:
  - the first-start name prompt;
  - the limits and how to change them in `settings.json`, noting that a restart is needed;
  - the `generation` section with its ranges;
  - `/prev` in the command table;
  - a short note that failures show the log path.

  Add a `/prev` row "(added by 012)" to `specs/006-usability/contracts/commands.md`. Help lists `/prev` through `COMMANDS()` (spec FR-014)

**Checkpoint**: checks pass. Commit.

---

## Phase 8: Polish

- [ ] T015 Run `pnpm build && pnpm lint && pnpm test`, the quickstart grep for `"User"`, and `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`. Fix any failures
- [ ] T016 Run `speckit-converge` on this feature and complete any appended tasks
- [ ] T017 Write `specs/012-chat-safeguards/report.md` with the same sections as `specs/011-tui-pickers/report.md`. Include test results, deferred tests, the owner's manual checks from `quickstart.md`, and the 0.1.1 release steps for the owner. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

- Phase 1 is needed by every story: settings, request options, `cutOff` and the default name.
- US1 to US4 all edit `app.ts`, so they run in order.
- T009 (engine) can be written before T010 (TUI).
- T013 needs US3, US4 and US5.

**Parallel**: T001 and T002 (different packages).

## Implementation Strategy

US1 and US2 protect the user; US3 and US4 fix the two most visible annoyances; US5 is a small
addition on top of Phase 1. The feature is complete only when all phases are done. If a run is
interrupted, leave the remaining tasks unchecked and say so in the report.
