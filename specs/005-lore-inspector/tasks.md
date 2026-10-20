---
description: "Task list for 005-lore-inspector"
---

# Tasks: Lore Inspector

**Input**: Design documents from `specs/005-lore-inspector/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-and-overlay.md,
quickstart.md

**Tests**: from the spec's "Acceptance Testing" section and plan.md's Test Plan (T-a to T-i).

**Read before starting**: `research.md` (R1 is the shared path, R3 the reason sentences, R4 the
layout, R5 the overlay and R6 the CLI syntax), plus 004's `character-chat.ts` and 002's
`library-format.ts`, whose pattern this feature copies.

## Rules for this run (unattended)

- **Stay on branch `005-lore-inspector`.** Never commit to `main`, and never switch, merge or
  rebase branches.
- **Do not stop to ask.** If something is unclear, write it to
  `specs/005-lore-inspector/questions.md`, take the most conservative option, and continue.
- **If a test is too complex to write**, record it under "Deferred tests" in the report and move on.
- **Never** read, print or use `.env`. **Never** run `pnpm test:live`. **Never** add a dependency.
- **The dry run must never** construct a `ChatSession`, an `Agent` or `SessionManager.create`, and
  must never write files.
- **Constitution V**: record your tool invocations and the run's platform-reported total tokens, or
  "unknown", in `specs/005-lore-inspector/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (shared path)

- [X] T001 In `packages/engine/src/character-chat.ts`, extract `assembleForCharacter({ paths, item, history, modelId })` → `{ prompt, trace, notices }` per research R1:
  - it re-reads the settings, resolves the attached lorebooks (skipping missing ones and returning their notices), takes the context window from `findAllowedModel`, and calls `assemblePrompt`;
  - `CharacterChat.send` and `regenerate` must call it, with no change in behaviour;
  - all existing 004 tests must pass unchanged (T-c).

  Export it from the engine barrel.

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - See a request before sending it (P1) 🎯 MVP

- [X] T002 [P] [US1] Implement `formatTraceReport(trace, meta)` and `formatAssembledPrompt(prompt)` in `packages/tui/src/trace-format.ts`. Use exactly research R3 (the reason sentences, `entry #n`, the ignored-features suffix) and R4 (the layout and the "No lorebooks." case). Align and truncate with pi-tui's `visibleWidth` and `truncateToWidth`. Write tests T-a and T-b in `trace-format.test.ts`, including the "every entry exactly once" and "group count equals listed entries" invariants
- [X] T003 [US1] Implement `dryRun({ paths, characterId, message?, session? })` in `packages/engine/src/dry-run.ts`:
  - resolve the character with `getItem` (prefix; ambiguous or not found returns an error);
  - build the history: for a new chat, the greeting with macros replaced, then the message; for a session, open it with `SessionManager.open(path, <dataDir>/sessions)`, read the current branch and append the message;
  - call `assembleForCharacter`.

  The session is found by id prefix through `listChats` or by file path. Write tests T-d, T-e and T-f in `dry-run.test.ts`. T-f compares against a simulated `CharacterChat.send`.
- [X] T004 [US1] Add the `dry-run` subcommand to `packages/tui/src/cli.ts` per research R6 and `contracts/cli-and-overlay.md`:
  - text mode prints the report lines, `── Request ──` and the prompt lines;
  - `--json` prints `JSON.stringify({ prompt, trace }, null, 2)`;
  - errors print one line and return 1;
  - the `meta` values come from the settings (`model`, `loreBudget`) and the character's name.

  Add the subcommand to `CLI_HELP`. Write tests T-g in `cli.test.ts`.

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 2 - See why the last reply knew what it knew (P1)

- [ ] T005 [P] [US2] Implement `TraceOverlay` in `packages/tui/src/components/trace-overlay.ts` per research R5. It holds the lines, `offset` and `height`; renders the window plus the footer `lines a–b of n · Esc to close`; handles Up/Down/PgUp/PgDn/Home/End within bounds; and calls `onClose` on Esc. Write tests T-h in `trace-overlay.test.ts`
- [ ] T006 [US2] In `packages/tui/src/app.ts`, add `/trace`:
  - no character chat: notice "The trace is available in character chats (/characters).";
  - no request yet: notice "No request yet — send a message, or use `littletavern dry-run`.";
  - otherwise: show `TraceOverlay` with `formatTraceReport(chat.lastTrace, meta)`, close it on Esc, and refocus the editor.

  Add `/trace` to `APP_HELP`.
- [ ] T007 [US2] Try T-i in `packages/tui/src/app-trace.test.ts` with the existing app test harness. If it needs more than about 60 lines, delete it and record it as deferred

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 3 - Read it at a glance (P2)

Most of this story is already covered by T002's layout. This phase checks it with a realistic
volume of entries.

- [ ] T008 [US3] Extend `trace-format.test.ts` with a synthetic trace of 30 entries (3 fired, 20 no-match, 4 budget, 3 disabled):
  - the first 3 + `fired` lines contain the summary and every fired entry;
  - each not-fired group is one header line with its count, and its names are cut to the width;
  - token figures carry the `~` estimate marker, and the summary says "(estimate)".

**Checkpoint**: checks pass. Commit.

---

## Phase 5: Polish

- [ ] T009 Run `pnpm build && pnpm lint && pnpm test`, plus the automated quickstart checks. Fix any failures
- [ ] T010 Write `specs/005-lore-inspector/report.md` with the same sections as the earlier reports, including "Development tool and token usage". Commit

---

## Dependencies & Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.

**Parallel**: T002 can be written alongside T001. T005 can be written alongside T003 and T004.

## Implementation Strategy

1. **MVP** = Phases 1–2: a dry run that works without a key. It is already demoable.
2. **US2** adds the live `/trace` overlay.
3. **US3** checks that the report is readable at a realistic size.
