# Implementation Plan: The Innkeeper

**Branch**: `014-innkeeper` (from `main` at 15a64b5) | **Date**: 2026-10-20 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from `specs/014-innkeeper/spec.md`

## Summary

Turn `/innkeeper` into a tool-using guide:

- six tools: read settings, list characters, list personas, help, change settings, open a chat;
- the two tools that change something ask the player first, and settings are backed up before
  every write;
- confirmed changes apply immediately;
- each player message is capped at `limits.toolRounds` rounds of tool calls, and its usage is
  summed over every request.

The innkeeper becomes a second pi `Agent` inside `ChatSession`, so the app keeps one session
object (research R3). The tools live in the engine and reach the TUI through callbacks (R4).

## Technical Context

**Language/Version**: TypeScript 7 with `tsc -b`; Node.js `>=22.19.0`.

**Primary Dependencies**: pi 1.3.0. `AgentTool`, `finishTurn` and sequential tool execution
(R1); typebox through pi-ai's re-export (R1). No new dependency.

**Storage**: `settings.json` gains `limits.toolRounds`; backups in `<configDir>/backups/`
(data-model.md). The innkeeper's conversation stays in memory.

**Testing**: Vitest with pi's faux provider. Faux replies can contain tool calls
(`fauxToolCall`, `../pi/packages/ai/src/providers/faux.ts:62`) and estimate usage per message
(`faux.ts:250–285`).

**Target Platform**: terminals on Linux, macOS and Windows.

**Constraints**: English only. No dependency. Build only what `tasks.md` asks for. The engine must
not import the TUI.

**Scale/Scope**:
- data: `updateSettings`, `checkSettingChange`, `toolRounds`;
- engine: the second agent, summed usage, `onToolCall`, `innkeeperHistory`, `setRequest`, the
  tools, the prompt;
- tui: the callbacks, confirmations, tool lines, pending open, live apply, `/innkeeper`
  re-render;
- docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.2.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | Tools, the loop, the round limit and sequential execution are pi-agent-core features (R1); character chats keep their assembled context and no tools |
| II. Wrap pi behind our types | Pass | The TUI sees `ChatSession`, `TurnResult`, `InnkeeperHistoryItem` and `createInnkeeperTools`; it never builds an `Agent` |
| III. Mechanism, not policy | Pass | The innkeeper changes only what the player approves; no content rules |
| IV. Lossless ecosystem data | Pass | Cards and lorebooks are untouched; settings writes keep unknown fields and are backed up |
| V. SDD development usage accounting | Pass | `specs/014-innkeeper/development-usage.md` |
| VI. MVP first | Pass | No long-term memory, no `/trace` for the innkeeper, no auto-approve, no restore command (spec out of scope) |
| VII. Understandable over clever | Pass | One `finishTurn`, validation and confirmation inside each tool, one rule table for settings |
| Workflow (3.2.0) | Pass | Branch from `main`; pull request merged by the owner |
| Testing policy | Pass | Unit tests for data and tools, app tests with faux tool calls, a happy path; the tone and look are checked by the owner |

## Project Structure

### Documentation (this feature)

```text
specs/014-innkeeper/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R10, with file:line citations
├── data-model.md
├── contracts/
│   └── messages.md       # prompt, tool labels, confirmations, tool results, notices
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/data/src/settings.ts                 # rule table, checkSettingChange, updateSettings, toolRounds (R6)
packages/engine/src/chat-session.ts           # second agent, summed usage, onToolCall, innkeeperHistory, setRequest, toolRounds (R3)
packages/engine/src/innkeeper-tools.ts        # new: the six tools (R4, R5, R8)
packages/engine/src/system-prompt.ts          # INNKEEPER_SYSTEM_PROMPT (R10)
packages/engine/src/index.ts                  # exports
packages/tui/src/app.ts                       # callbacks, confirmations, tool lines, pendingOpen, buildRequest, applied, /innkeeper (R7–R9)
packages/tui/src/commands.ts                  # /innkeeper description
README.md                                     # the innkeeper, backups, limits.toolRounds
```

**Structure Decision**: keep the three packages. Settings rules and the safe write in `data`; the
agent and the tools in `engine`; the questions and wording in `tui`.

## Integration note: 013

013 (chat editing) merged into `main` at 4d8fd4d, and `main` was merged into this branch at
91985ef before implementation. The research citations were refreshed against that code. The
implementer does not merge. The two features touch different parts of `app.ts`: 013 the
character-chat commands and editing state (`/undo`, `/edit`, the `editing` branch at the top of
`submit()` and its Esc and Ctrl+R handling in the input listener), 014 the innkeeper send path
and settings state. 013's editing state exists only in a character chat, so it never meets the
innkeeper's confirmations; keep 013's code and tests as they are.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `checkSettingChange` for every key in data-model.md (valid, invalid, `null` where allowed and not); `readRequestSettings` reads `toolRounds` (default, valid, invalid with warning) | low | **write** |
| T-b | `updateSettings`: nested merge keeps sibling fields and unknown fields; `null` removes; backup created with the old bytes; two backups in the same millisecond do not overwrite; no file → no backup; malformed file → throws, file untouched, no backup | low–medium | **write** |
| T-c | Tools, each with a temporary home: `read_settings` (effective values; the key is in the credentials file and in the env and never appears); `list_characters`; `list_personas` (active flag); `get_help`; `change_settings` (invalid → error, no confirm; declined; accepted → written, backup, `applied` called with only the changes); `open_chat` (new, resume newest, no saved chat, unknown, ambiguous, by id; `details.endTurn`) | medium | **write** |
| T-d | `ChatSession` innkeeper: faux tool call → tool runs → final answer; `onToolCall` fires with the label; usage is the sum of both messages; `toolRounds` 1 stops after one round with `toolLimitReached`; a tool with `details.endTurn` ends the run; character `generate()` still sends no tools and is unaffected by innkeeper messages; `innkeeperHistory()` items; `setRequest` changes the next request's options | medium | **write** |
| T-e | App: tool lines in order with the reply text; change confirmation (lines, Yes, No, Esc = No without abort); the next character request uses the new `maxTokens`; `runSpendUsd` change resets the allowance; `mouse` restart notice; open chat after the run (new and resume), usage filed under the innkeeper; `/innkeeper` re-renders the conversation; `/new` clears it; the round-limit notice | medium | **write** |
| T-f | **Happy path** (faux): help lookup → answer; change `replyTokens` to 1000 → Yes → backup exists → a character send asks for 1000; open Alice → chat open | medium | **write** |
| — | Real-model tool use, tone, the look of lines and pickers | — | **owner, manual** (quickstart) |

## Notes for the owner

- The plain chat's generic roleplay prompt is replaced by the innkeeper's prompt (R10).
- Confirmation moved from `beforeToolCall` (the note from before 010) into each tool, so invalid
  values never reach the player (R1).
- A chat opened by the innkeeper opens after its reply finishes, so the innkeeper's usage is
  filed under the innkeeper (R8).

## Complexity Tracking

No constitution exceptions are needed.
