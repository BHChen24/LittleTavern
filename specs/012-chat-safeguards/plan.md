# Implementation Plan: Chat Safeguards

**Branch**: `012-chat-safeguards` (from `main`; `main` at `1769fb8` merged in) | **Date**:
2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-chat-safeguards/spec.md`

## Summary

Make chats safer for the user's money and clearer when something goes wrong:

- failures get a short notice (retry hint, retry count, log path), and the log gets the details;
- every request is capped at 4096 output tokens, and the run asks before spending past 1 USD;
- `generation` settings tune sampling, and `/trace` shows what was sent;
- `/prev` swaps back the reply that the last regenerate replaced;
- the player is asked for a name once, and the fallback becomes "Traveler".

Everything goes through pi's existing request options and session tree. There is no new
dependency and no new storage format.

## Technical Context

**Language/Version**: TypeScript 7 with `tsc -b`; Node.js `>=22.19.0`.

**Primary Dependencies**: pi 1.3.0. Request options travel through `StreamFn`'s
`SimpleStreamOptions` (R1); the session tree is pi's `SessionManager` (R6). No new dependency.

**Storage**: optional `limits` and `generation` sections in `settings.json`, plus the existing
`userName` (data-model.md). `/prev` appends a copy of a reply to the session file (R6).

**Testing**: Vitest with pi's faux provider. Faux replies can report errors and usage; length
stops are simulated with a faux message whose `stopReason` is `"length"`.

**Target Platform**: terminals on Linux, macOS and Windows.

**Constraints**: English only. No dependency. Build only what `tasks.md` asks for.

**Scale/Scope**:
- data: settings;
- engine: `ChatSession`, `CharacterChat`, trace, assembly reserve, default name;
- tui: notices, picker, name prompt, `/prev`, the input listener, the home screen, trace format;
- docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.2.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | Request options use pi's `StreamFn` options (R1); `/prev` uses `SessionManager.branch` and `appendMessage` (R6); no hand-rolled transport or retry |
| II. Wrap pi behind our types | Pass | The TUI uses engine methods (`CharacterChat.prev()`, `TurnResult.cutOff`, `ChatSession.request`) |
| III. Mechanism, not policy | Pass | The limits are the user's settings with defaults; no content rules |
| IV. Lossless ecosystem data | Pass | Cards and lorebooks are untouched |
| V. SDD development usage accounting | Pass | `specs/012-chat-safeguards/development-usage.md` |
| VI. MVP first | Pass | No automatic retry, no `/limits` command, no presets, no daily cap (spec out-of-scope list) |
| VII. Understandable over clever | Pass | One `readRequestSettings` validator; one `formatLimits`; `/prev` is "append a copy", which is easy to explain |
| Workflow (3.2.0) | Pass | Branch from `main`; pull request merged by the owner |
| Testing policy | Pass | Unit tests for our functions; the happy path with the faux provider; the look is checked by the owner |

## Project Structure

### Documentation (this feature)

```text
specs/012-chat-safeguards/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R11, with file:line citations
├── data-model.md
├── contracts/
│   └── messages.md       # every message, the /prev command, the name prompt, the trace line
├── quickstart.md
└── tasks.md              # $speckit-tasks output
```

### Source Code (repository root)

```text
packages/data/src/settings.ts                 # readRequestSettings (R9)
packages/engine/src/assembly/types.ts         # DEFAULT_USER_NAME = "Traveler" (R8)
packages/engine/src/assembly/assemble.ts      # reserve max(replyReserve, replyTokens) (R10)
packages/engine/src/chat-session.ts           # request options via streamFn wrapper; cutOff; get request (R1, R2)
packages/engine/src/character-chat.ts         # replaced + prev(); trace.request; pass replyTokens to assembly (R6, R9, R10)
packages/tui/src/commands.ts                  # + prev
packages/tui/src/components/name-prompt.ts    # new (R8)
packages/tui/src/components/home-screen.ts    # limits line (R11)
packages/tui/src/trace-format.ts              # Request line (R9)
packages/tui/src/app.ts                       # failure notices, retries, spend picker, notes, /prev, name prompt, input listener, setup notice
README.md                                     # limits, generation, /prev, name
specs/006-usability/contracts/commands.md     # /prev row (added by 012)
```

**Structure Decision**: keep the three packages. Settings validation stays in `data`. Request
options and the session tree stay in `engine`. Wording stays in `tui`. The app passes the request
options to the `ChatSession` it creates, from `readRequestSettings` at start.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `readRequestSettings`: defaults; valid values; each invalid field dropped with its warning; 0 accepted for both limits; other settings unaffected | low | **write** |
| T-b | `ChatSession` request options: the stream options received by the faux stream contain `maxTokens`, `temperature` and `samplingParams` exactly as configured; with no `generation`, only `maxTokens` | low–medium | **write**: pi's faux response factory receives the stream options (`../pi/packages/ai/src/providers/faux.ts:109–114`); add an optional `simulated.onRequest(options)` hook to `ChatSessionOptions` for tests |
| T-c | `cutOff`: a faux reply with `stopReason: "length"` gives `outcome: "completed"` and `cutOff: true`, and is saved in a character chat | low | **write** |
| T-d | `CharacterChat.prev()`: A → regenerate B → prev shows A and history ends with A; prev again shows B; A → B → C, prev gives B; send clears; a reopened file has nothing to restore; after prev and a reopen, the history ends with the restored reply | medium | **write** |
| T-e | App failure notices: one per kind with the exact contract text; the partial-text marker; no partial text; retries 0 → 1 across a failed retry, reset after success; the log entry has `error`, `model`, `kind` and no key; the innkeeper variant | medium | **write** |
| T-f | App limits: the spend picker appears at the cap for send, regenerate and innkeeper; `Stop` keeps the text and sends nothing; `Continue` sends and raises the allowance; the cut-off note once; the unknown-price note once; the reminder line on the home screen and in the setup notice, gone after a chat starts; 0 shows "not capped" | medium | **write** |
| T-g | App `/prev`: swap and swap back on screen; nothing to restore; the innkeeper message; Enter with `/prev` or `/new` while streaming shows the wait message (input listener) | low–medium | **write** |
| T-h | App name prompt: shown with `Traveler` when no name and no persona; Enter saves the typed or default name; Esc saves nothing and the next start asks again; an empty name is refused; not shown with a saved name or an active persona | low–medium | **write** |
| T-i | Trace line: `Request: …` with parameters, and `model defaults` | low | **write** |
| T-j | Assembly reserve: with `replyTokens` 8000 the history budget shrinks by the extra; with 0 it is unchanged | low | **write** |
| T-k | **Happy path** (faux): a fresh home; name prompt → "Mira"; a synthetic card whose greeting has `{{user}}`; send; regenerate; `/prev`; the next request contains the restored reply and "Mira"; `/trace` shows the request line | medium | **write** |
| — | The look of the notices, the picker and the prompt | — | **owner, manual** (quickstart) |

## Notes for the owner

- This feature also fixes a gap found in 011: in the real app, Enter is ignored while a reply
  streams, so `/new`'s wait message could never appear (R7).
- The innkeeper's retry hint differs, because it has no regenerate (spec plan-time
  corrections).
- The "Changes outside Spec Kit" section for `AGENTS.md` is not included; it waits for the
  owner's approval.

## Complexity Tracking

No constitution exceptions are needed.
