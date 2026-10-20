# Implementation Plan: Character Chat

**Branch**: `004-character-chat` (stacked on `003-prompt-assembly`) | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-character-chat/spec.md`

## Summary

A new engine class, `CharacterChat`, ties the existing parts together:

- a 002 library character;
- 003's `assemblePrompt`;
- 001's `ChatSession`, extended with a `generate(context)` method that runs one turn on a fully
  assembled context through the agent's `transformContext` hook;
- pi's coding-agent `SessionManager`, which stores each chat as an append-only JSONL tree.

Regenerate uses `SessionManager.branch()`, so a replaced reply becomes a sibling that stays in
the file. The TUI adds a character picker, a saved-chat list, lorebook attachment commands and
Ctrl+R. Settings gain the user name, the assembly numbers and the lorebook attachments, and are
re-read before every request.

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: all already pinned:

- `@earendil-works/pi-agent-core@1.3.0`: `Agent.transformContext`;
- `@earendil-works/pi-ai@1.3.0`: message types and the faux provider;
- `@earendil-works/pi-coding-agent@1.3.0`: `SessionManager`, used here for the first time;
- `@earendil-works/pi-tui@1.3.0`.

No new dependencies.

**Storage**:

- sessions: `<dataDir>/sessions/*.jsonl` (pi format);
- settings: `<configDir>/settings.json`, extended;
- the usage ledger: unchanged.

**Testing**: Vitest with the simulated model. Session tests use a temporary `LITTLETAVERN_HOME`.

**Target Platform**: Linux and WSL.

**Project Type**: workspace feature that touches `data` (settings), `engine` (`ChatSession`,
`CharacterChat`) and `tui` (commands, pickers).

**Performance Goals**: none beyond 001's. Assembly and session appends take milliseconds.

**Constraints**:

- The engine's public API exposes no pi types.
- pi's default `~/.pi` directories are never used.
- Plain chat behaves exactly as in 001.

**Scale/Scope**: about 6 new or changed source files plus the commands in `app.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.0.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | The loop comes from `Agent`, session storage and branching from `SessionManager`, and widgets from pi-tui. The context (assembly) is ours. `sessionDir` and `cwd` point at our data directory, never at `~/.pi` |
| II. Wrap pi behind our types | Pass | The pi adapter modules are `chat-session.ts` (existing) and `character-chat.ts` (new). The public API uses `ChatContext`, `ChatHistoryItem`, `TurnResult` and the chat-list entry, all our own types |
| III. Mechanism, not policy | Pass | Regenerate and resume follow fixed rules, unknown session records are ignored, and nothing is repaired |
| IV. Lossless ecosystem data | Pass | Library items are read and never modified. Session files only grow |
| V. SDD development usage accounting | Pass | Recorded in `specs/004-character-chat/development-usage.md` |
| VI. MVP first | Pass | No swipe browsing, editing, continue or alternate greetings, as stated in the spec's Assumptions |
| VII. Understandable over clever | Pass | One new class with the small methods listed in data-model.md. Pickers reuse 001's pattern |
| Testing policy | Pass | See the Test Plan below |

Post-design re-check: unchanged, all gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/004-character-chat/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/commands.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/data/src/settings.ts              # + userName, loreBudget, scanDepth, replyReserve, lorebookAttachments; merge on write
packages/engine/src/chat-session.ts        # + ChatContext type, generate(context)
packages/engine/src/character-chat.ts      # CharacterChat (research R2), listChats(paths)
packages/engine/src/character-chat.test.ts
packages/engine/src/index.ts               # + exports
packages/tui/src/components/character-picker.ts
packages/tui/src/components/session-picker.ts
packages/tui/src/app.ts                    # character mode, commands, Ctrl+R, status bar name, transcript rebuild
packages/tui/src/app-character.test.ts
```

**Structure Decision**: Orchestration goes in `engine`: assemble, generate and persist.
`app.ts` stays a thin view. It tells the `CharacterChat` what to do and renders `history()`
and the deltas.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | Settings: each new field is validated on its own; writing merges and keeps unknown fields | low | **write** |
| T-b | `ChatSession.generate`: the simulated model receives the system text, the user and character turns, and a trailing system message for `afterHistory`; deltas and `TurnResult` work as in `send` | medium | **write** (001's history callback makes the received context observable) |
| T-c | `CharacterChat.start`: greeting with macros replaced; the character, session-info and greeting records; `history()` starts with the greeting; an empty greeting gives an empty history | low | **write** |
| T-d | `send`: the request contains the description and a triggered lore entry; `lastTrace` is set; the usage record carries the pi session id | medium | **write** |
| T-e | `regenerate`: the leaf reply becomes a sibling and the next request has only the new reply (SC-003); a user leaf generates directly; greeting only → `"nothing-to-regenerate"`; the old reply is still in the file | medium | **write** |
| T-f | Resume: start, send twice, regenerate once, reopen from the file, and `history()` equals the pre-quit current branch (SC-004); a missing character → error | medium | **write** |
| T-g | Attachments: attach, persist, detach; the attached lorebook's entry is triggered in the trace; a missing attached lorebook is skipped with a notice | low | **write** |
| T-h | TUI: `/characters` → select → greeting rendered; Ctrl+R replaces the last reply component | medium-high | **try** with 001's app test harness. If it needs more than about 60 lines, defer and keep it manual |

## Complexity Tracking

No constitution violations need justifying.
