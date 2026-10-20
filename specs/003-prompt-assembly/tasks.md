---
description: "Task list for 003-prompt-assembly"
---

# Tasks: Prompt Assembly with Lore Trace

**Input**: Design documents from `specs/003-prompt-assembly/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/assembly-api.md,
quickstart.md

**Tests**: These come from the spec's "Acceptance Testing" section and plan.md's Test Plan (T-a
to T-h).

**Read before starting**: `research.md` (every rule: R3 tokens, R5 activation, placement and
ignored features, R6 budget, R7 history fit, R8 defaults) and `data-model.md` (types and
invariants).

## Rules for this run (unattended)

- **Stay on branch `003-prompt-assembly`.** Never commit to `main`, and never switch, merge or
  rebase branches.
- **Do not stop to ask.** If something is unclear, write it to `specs/003-prompt-assembly/questions.md`,
  take the most conservative option, and continue.
- **If a test is too complex to write**, record it under "Deferred tests" in the report and move on.
- **Never** read, print or use `.env`, **never** run `pnpm test:live`, and **never** add a dependency.
- **Constitution V**: record your tool invocations and the run's platform-reported total tokens (or
  "unknown") in `specs/003-prompt-assembly/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message and mark the finished tasks `[X]` in the same commit.
- **Keep the code explainable**: one file per pipeline step, small pure functions, no mutation of
  the input, and no pi imports anywhere under `assembly/`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Create `packages/engine/src/assembly/types.ts` with every type in data-model.md, verbatim, plus `DEFAULT_ASSEMBLY_SETTINGS = { scanDepth: 2, loreBudget: 4000, replyReserve: 4000 }`, `DEFAULT_USER_NAME = "User"`, `DEFAULT_CONTEXT_WINDOW = 128000`, and `DEFAULT_MAIN_INSTRUCTION = "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}."`
- [X] T002 [P] Create `packages/engine/src/assembly/fixtures.ts`, used by tests only. It provides `makeCharacter(overrides)`, which returns a full 002 `Character` with empty defaults; `makeEntry(overrides)`, which returns a `LorebookEntry` with `source` defaulting to `{}`; `makeLorebook(name, entries)`; and `chat(...texts)`, which alternates user and character messages starting with user

**Checkpoint**: checks pass. Commit.

---

## Phase 2: Foundational

- [X] T003 [P] Implement `estimateTokens(text)` in `packages/engine/src/assembly/tokens.ts` per research R3: count the characters matching `/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u` as one token each, and add `Math.ceil(rest / 4)`. Write tests T-a in `tokens.test.ts`
- [X] T004 [P] Implement `replaceMacros(text, { char, user })` in `packages/engine/src/assembly/macros.ts` per R4, using `/\{\{\s*(char|user)\s*\}\}/gi`. Write tests T-b in `macros.test.ts`
- [X] T005 [P] Add `contextWindow: number` to `ModelInfo` in `packages/engine/src/models.ts`, taken from pi's `model.contextWindow`, and extend `models.test.ts` to check that the default model has a positive value

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 1 - The character definition reaches the model (P1) 🎯 MVP

**Goal**: Card fields, history and post-history instructions are assembled in FR-004 order, with
the macros replaced.

- [X] T006 [US1] Implement `fitHistory(history, availableTokens)` in `packages/engine/src/assembly/history.ts` per R7. It walks newest-first and stops at the first message that does not fit, always keeps the newest message, and returns `{ kept, leftOut, overflow: boolean }`. Write tests T-f in `history.test.ts`
- [X] T007 [US1] Implement `assemblePrompt(input)` in `packages/engine/src/assembly/assemble.ts`, initially without lore:
  - Fill in the defaults: settings, `userName` and `contextWindow`.
  - Build the system parts in FR-004 order. Replace macros in each part and omit parts that are empty after trimming. The main instruction is `character.systemPrompt` if it is non-blank, otherwise `DEFAULT_MAIN_INSTRUCTION`. Join the parts with `\n\n`.
  - Set `afterHistory` to `postHistoryInstructions` after macro replacement, or `null`.
  - Fit the history into `contextWindow − replyReserve − tokens(system) − tokens(afterHistory)`.
  - Build `trace.parts`, with one `TracePart` per included part and its `estimateTokens`, and `trace.history`. Add the note `"request exceeds the context window"` when the history overflows. Compute `totalTokens`.
- [X] T008 [US1] Write the User Story 1 tests in `packages/engine/src/assembly/assemble.test.ts`: the order, empty parts omitted, the default main instruction versus the card's system prompt, macros replaced everywhere, `afterHistory`, history roles and order, and determinism (deep-equal across two runs)
- [X] T009 [US1] Export the assembly API from `packages/engine/src/index.ts` as listed in `contracts/assembly-api.md`

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 2 - Lore appears when the conversation calls for it (P1)

- [X] T010 [US2] Implement the activation part of `packages/engine/src/assembly/lore.ts`, following R5 exactly.
  - **Entry order**: the character's embedded lorebook first, then `input.lorebooks`.
  - **Scan**: the last `scanDepth` messages. For each message, replace macros, lowercase it, and search for each key; message numbers are 1-based positions in the full history.
  - **Decision order**: disabled → constant → no-keywords → first keyword match, scanning from the newest message → no-match. Empty-string keys are ignored.
  - **Helpers**: `placementOf(entry)` (the R5 placement rules) and `ignoredFeatures(entry)` (the R5 list, reading `entry.source` only).
  - **Output**: one `LoreDecision` per entry.

  Write tests T-c and T-d in `lore.test.ts`.
- [X] T011 [US2] Wire lore into `assemblePrompt`. Included entries are grouped by placement, sorted ascending by `insertionOrder` (ties keep their source order), and their contents, after macro replacement and joined with `\n`, become the `lore-before` part (before the description) and the `lore-after` part (after the scenario). Add the `lore-before` and `lore-after` `TracePart`s with `detail` "N entries", and set `trace.lore`. Add tests to `assemble.test.ts`: the User Story 2 example (constant, lighthouse, harbor, disabled) gives the exact reasons from spec User Story 4, and every entry appears exactly once in `trace.lore` (SC-002)

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 3 - Lore stays within a budget (P2)

- [X] T012 [US3] Implement `applyLoreBudget(candidates, budget)` in `lore.ts` per R6. Sort by `insertionOrder` descending, breaking ties by source order, and accumulate `estimateTokens`. The first candidate that does not fit, and every candidate after it, is marked `{ included: false, reason: { kind: "budget" } }`. Record `tokens` on every candidate. Call it from `assemblePrompt` before placement. Write tests T-e in `lore.test.ts`: the admission order, constant entries competing, the invariant that the included sum is at most the budget, and the default budget of 4000 when no setting is given

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 4 - Every request explains itself (P1)

Most of the trace was built in Phases 3 to 5. This phase checks that it is complete.

- [X] T013 [US4] Extend `assemble.test.ts`:
  - **Invariants** from data-model.md: every entry exactly once; included plus left-out equals the history length; the included lore sum is at most the budget.
  - **Ignored features**: an entry with secondary keys and `probability: 50` lists both features in `ignoredFeatures`.
  - **Tokens**: `trace.tokensAreEstimates === true`.
  - **Data only**: the trace contains no preformatted text, only the structured fields.

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Polish

- [X] T014 [P] Add the local sample test T-h in `packages/engine/src/assembly/samples.local.test.ts`. The directory is `process.env.LITTLETAVERN_TEST_CARDS ?? path.resolve(<repo root>, "../test-cards")`, and the suite is skipped with `describe.skipIf(!existsSync(dir))`. For each sample character card, call 002's `importFile` into a temporary `LITTLETAVERN_HOME`, then assemble with `chat("你好", "……")`, and assert that `trace.lore.length` equals the card's entry count. Seraphina's entries should all be placed `before`
- [X] T015 Run `pnpm build && pnpm lint && pnpm test` and fix any failures
- [X] T016 Write `specs/003-prompt-assembly/report.md` with the same sections as the 001 and 002 reports, including "Development tool and token usage". Commit

---

## Dependencies & Execution Order

The phases run in order: Setup → Foundational → US1 → US2 → US3 → US4 → Polish. US2 and US3 both
edit `lore.ts` and `assemble.ts`, so do not run them in parallel.

**Parallel**: T002, T003, T004 and T005 are independent.

## Implementation Strategy

1. **MVP** = Phases 1 to 3: the card reaches the model, with no lore yet.
2. **US2** adds lore activation, which is the core value.
3. **US3** adds the budget.
4. **US4** verifies the trace's completeness, which feeds 005's demo.
