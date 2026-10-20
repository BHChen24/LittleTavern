# Implementation Plan: Chat Editing

**Branch**: `013-chat-editing` (from `main` at 15a64b5) | **Date**: 2026-10-20 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from `specs/013-chat-editing/spec.md`

## Summary

Let the player correct a character chat:

- `/undo` takes back the last turn and puts the player's text back into the input;
- `/edit` picks any message, edits it in the input, and continues the chat from it. An edited
  player message is resent; an edited character message is only saved.

Both use pi's session branches. The rule that keeps everything consistent is that **the last
entry in the session file is the last item the chat shows** (research R1). Undo keeps it by
appending a copy of the entry before the undone message, as `/prev` does (R2). Edit keeps it by
appending the new version (R3). There is no new dependency and no new file format.

## Technical Context

**Language/Version**: TypeScript 7 with `tsc -b`; Node.js `>=22.19.0`.

**Primary Dependencies**: pi 1.3.0: `SessionManager.branch`, `resetLeaf`, `appendMessage`,
`appendCustomEntry` (R1), and the pi-tui `Editor` (R4). No new dependency.

**Storage**: the existing session files. No format change (data-model.md).

**Testing**: Vitest with the simulated provider. Engine tests reopen the session file to check
persistence; app tests drive `submit()` and the input listener.

**Target Platform**: terminals on Linux, macOS and Windows.

**Constraints**: English only. No dependency. Build only what `tasks.md` asks for.

**Scale/Scope**:
- engine: `CharacterChat` (`undo`, `resendFrom`, `editReply`) and `ChatHistoryItem.entryId`;
- tui: two commands, the edit picker, the editing state, the `InputBox` banner, and the input
  listener;
- docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.2.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | Branches and appends are pi's `SessionManager` methods (R1–R3); the context is still built by `historyFromEntries` and assembly |
| II. Wrap pi behind our types | Pass | The TUI calls `CharacterChat.undo/resendFrom/editReply` and reads `ChatHistoryItem.entryId`; it never touches the session manager |
| III. Mechanism, not policy | Pass | The player edits any message; no content rules |
| IV. Lossless ecosystem data | Pass | Cards and lorebooks are untouched; nothing is deleted from session files |
| V. SDD development usage accounting | Pass | `specs/013-chat-editing/development-usage.md` |
| VI. MVP first | Pass | No branch browser, no greeting edit, no external editor, no shortcut (spec out of scope) |
| VII. Understandable over clever | Pass | One invariant, and undo reuses `/prev`'s "branch, append a copy" |
| Workflow (3.2.0) | Pass | Branch from `main`; pull request merged by the owner |
| Testing policy | Pass | Unit tests for the engine methods, app tests for the commands and the editing state, a happy path; the look is checked by the owner |

## Project Structure

### Documentation (this feature)

```text
specs/013-chat-editing/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R6, with file:line citations
├── data-model.md
├── contracts/
│   └── messages.md       # commands, picker, banner and every message
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/engine/src/character-chat.ts         # entryId in history; undo, resendFrom, editReply (R2, R3)
packages/tui/src/commands.ts                  # + undo, edit
packages/tui/src/components/input-box.ts      # optional banner line (R4)
packages/tui/src/app.ts                       # handlers, edit picker, editing state, submit, input listener (R4, R5)
README.md                                     # /undo, /edit
specs/006-usability/contracts/commands.md     # /undo and /edit rows (added by 013)
```

**Structure Decision**: keep the three packages. The session tree stays in `engine`; the editing
state and the wording stay in `tui`. No change in `data`.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `history()` items: messages have `entryId`; the greeting has none | low | **write** |
| T-b | `undo()`: a full turn (text returned, history one turn shorter); a reply-less user message after a failure; only the greeting → `"nothing-to-undo"`; twice in a row; a card without a greeting (the root is the character entry); after undo, `regenerateTarget()` is `"reply"` on the previous reply and regenerate works; `prev()` → nothing; **reopen the file** → same history | medium | **write** |
| T-c | `resendFrom()`: the edited message replaces turn 2 of 3, a reply is generated, and history = turn 1 + edited + reply; the request contains the edited text and not the dropped turns; a failure keeps the edited message without a reply; a wrong id or a reply id throws; reopen → same history | medium | **write** |
| T-d | `editReply()`: text replaced and later messages dropped; nothing is sent (no request on the faux provider); an interrupted reply loses the mark; a wrong id or a user id throws; `prev()` → nothing; reopen → same history | low–medium | **write** |
| T-e | App `/undo`: transcript re-rendered, the input holds the text; nothing to undo; the innkeeper and no-chat messages; the wait message while streaming (submit and input listener) | low–medium | **write** |
| T-f | App `/edit`: picker order (newest first), labels, no greeting, filter by text; no messages; the innkeeper and no-chat messages; the wait message while streaming | medium | **write** |
| T-g | App editing state: banner shown and cleared; Enter on a user message resends (dropped messages gone from the transcript), also when the text is unchanged; Enter on a character message saves without a request; unchanged character message → `No changes.`; empty → error, editing continues; text starting with `/` is saved, not run; Esc → `Edit cancelled.`, chat unchanged; Esc with the autocomplete menu open closes the menu only; Ctrl+R → the contract message, no regenerate; the spend cap `Stop` keeps editing | medium | **write** |
| T-h | **Happy path** (faux): a chat with a synthetic card; send twice; `/undo`; change the text; send; `/edit` the first reply; save; resume the session file in a new app; the transcript matches | medium | **write** |
| — | The look of the picker and the banner | — | **owner, manual** (quickstart) |

## Notes for the owner

- Undo writes a copy of the entry before the undone message (usually the previous reply). The
  file grows by one entry per undo, as with `/prev` (research R2).
- While editing, Ctrl+O still opens `$EDITOR` for the input text, because it only changes the
  input (research R4). The spec's "no external editor" means no new editor flow for edits.
- If the setup becomes incomplete while editing (for example a rejected key cleared it), saving
  a player message shows the setup notice and keeps editing; Esc, fix it, and edit again
  (research R5).

## Complexity Tracking

No constitution exceptions are needed.
