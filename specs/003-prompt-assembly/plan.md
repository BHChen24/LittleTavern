# Implementation Plan: Prompt Assembly with Lore Trace

**Branch**: `003-prompt-assembly` (stacked on `002-card-import`) | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-prompt-assembly/spec.md`

## Summary

`assemblePrompt(input)` is a pure engine function that turns a 002 character, its lorebooks, the
user's name and the chat history into `{ system, history, afterHistory }`, together with a
structured trace. The function runs a pipeline of small steps:

1. replace the macros;
2. activate lore entries by keyword or constant flag;
3. apply the lore budget;
4. place the lore before or after the character definition;
5. build the system text;
6. fit the history newest-first into the context window;
7. add the post-history instructions.

Each step appends its own decisions to the trace. Token counts are a CJK-aware estimate. There
is no UI and no pi import; 004 wires the result into chat.

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: none new. Uses the 002 types `Character`, `Lorebook` and
`LorebookEntry` from `@littletavern/data`, reached through the engine barrel.

**Storage**: none.

**Testing**: Vitest unit tests, with fixtures built in code. The local sample test uses
`../test-cards/` when present.

**Target Platform**: any; the function is pure.

**Project Type**: an engine module in the existing workspace.

**Performance Goals**: assembling with hundreds of entries and history messages takes
milliseconds. No targets are needed.

**Constraints**:
- Pure, synchronous and deterministic.
- No I/O, no pi imports, and the input is never mutated.

**Scale/Scope**: about 7 small source files.

**Small cross-feature change**: add `contextWindow: number` to `ModelInfo` in
`packages/engine/src/models.ts`, mapped from pi's `Model.contextWindow`. 004 needs it to pass the
window into the assembly.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against the constitution on `002-card-import`: 2.0.0, plus Codex's pending one-line fix
to the branch rule.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | This is the "own the context" part. pi offers nothing for card-based assembly. The token estimate is ours because pi's characters ÷ 4 undercounts CJK about fourfold (research R3) |
| II. Wrap pi behind our types | Pass | No pi imports. The output `AssembledPrompt` is our own type, and 004 converts it |
| III. Mechanism, not policy | Pass | The rules are fixed and simple. Unsupported entry features are noted, not guessed at |
| IV. Lossless ecosystem data | Pass | Reads 002's normalized data and `source`. Nothing is modified |
| V. SDD development usage accounting | Pass | The implementing agent records its usage in `specs/003-prompt-assembly/development-usage.md` |
| VI. MVP first | Pass | Each simplification is listed in the spec; summarisation is deferred, as clarified |
| VII. Understandable over clever | Pass | One file per pipeline step, each small. The trace is plain data |
| Testing policy | Pass | See the Test Plan below |

Re-checked after Phase 1 design: unchanged, all gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/003-prompt-assembly/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/assembly-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/engine/src/assembly/
├── types.ts          # AssemblyInput, HistoryMessage, AssemblySettings, AssembledPrompt, AssemblyTrace, TracePart, LoreDecision, defaults
├── tokens.ts         # estimateTokens (research R3)
├── macros.ts         # replaceMacros (R4)
├── lore.ts           # activateLore, ignoredFeatures, placementOf (R5), applyLoreBudget (R6)
├── history.ts        # fitHistory (R7)
├── assemble.ts       # assemblePrompt: runs the steps in order and builds the trace
├── tokens.test.ts, macros.test.ts, lore.test.ts, history.test.ts, assemble.test.ts
├── fixtures.ts       # test helpers: makeCharacter, makeEntry, makeLorebook, history builder
└── samples.local.test.ts  # SC-004, skipped without ../test-cards
packages/engine/src/models.ts   # + contextWindow on ModelInfo
packages/engine/src/index.ts    # + export * from "./assembly/..."
```

**Structure Decision**: The code sits in `engine`, because assembly is engine logic and 004's
chat session lives there. One file per pipeline step keeps each piece easy to explain in an
interview.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `estimateTokens`: English text is about chars ÷ 4; each Chinese character counts as 1; mixed text | low | **write** |
| T-b | `replaceMacros`: case variants, spaces inside the braces, other macros left alone | low | **write** |
| T-c | Activation: constant, keyword within depth, keyword only beyond depth, case-insensitive, Chinese keyword, disabled, no keywords, empty key ignored, macro in key, the first match is reported with the right message number | low | **write** |
| T-d | Placement and ignored features: numeric 0/1, `before_char`/`after_char`, missing, unknown number; the secondary/regex/probability notes | low | **write** |
| T-e | Budget: descending order admits until overflow, then the remaining entries get `budget`; constant entries compete; invariant: sum ≤ budget | low | **write** |
| T-f | History fit: everything fits; oldest left out; newest kept even when it overflows (note); invariant: included + leftOut = length | low | **write** |
| T-g | `assemblePrompt`: FR-004 order with empty parts omitted; the default main instruction versus the card's system prompt; `afterHistory`; the User Story 2 example trace; every entry exactly once in the trace; determinism | low–medium | **write** |
| T-h | Local samples (SC-004): import each sample card with 002's `importFile` into a temporary library, assemble with two scripted messages, and check that every lorebook entry is in the trace | low | **write**, skipped without `../test-cards/` |

Snapshot tests of the whole system text are **not** used. Assertions target structured fields, so
wording changes during refinement do not break dozens of tests.

## Complexity Tracking

No constitution violations need justifying.
