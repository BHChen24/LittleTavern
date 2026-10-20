# Implementation Plan: TUI Chat Skeleton

**Branch**: `001-tui-chat` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-tui-chat/spec.md`

## Summary

A walking skeleton. A pi-tui app shows the LittleTavern title, gets an OpenRouter key (from the
environment, a saved file, or a masked prompt with explicit consent to save), lets the user pick
an OpenAI or Gemini model, and streams a plain chat through pi-agent-core's `Agent` with a fixed
roleplay system prompt. Every request appends one record to a JSONL usage ledger, and the status
bar shows the session totals. The approach is to reuse pi for the loop, the transport, the
pricing and the widgets, and to write only the glue: key handling, model filtering, usage
mapping and the screen layout.

## Technical Context

**Language/Version**: TypeScript 7 (`tsc -b`, `erasableSyntaxOnly`), Node 26 (local 26.7.0)

**Primary Dependencies** (all already installed, pinned exactly):
- `@earendil-works/pi-ai@1.3.0`: models, OpenRouter provider, streaming, faux provider.
- `@earendil-works/pi-agent-core@1.3.0`: `Agent`.
- `@earendil-works/pi-tui@1.3.0`: TUI and components.
- `env-paths`, `pino`.

`pi-coding-agent` is installed but **not used** in this feature. **No new dependencies.**

**Storage**: Plain files. The saved key and settings are JSON; the usage ledger is JSONL; the log
is pino output. See [data-model.md](./data-model.md).

**Testing**: Vitest, with the simulated model (pi-ai faux provider). Opt-in live tests use the
`*.live.test.ts` naming and are excluded from `pnpm test`.

**Target Platform**: Linux and WSL terminals (macOS likely works but is not verified)

**Project Type**: CLI/TUI application in a pnpm workspace (`data` → `engine` → `tui`)

**Performance Goals**: The first streamed text appears as soon as the provider sends it (SC-002).
Nothing else is performance-sensitive.

**Constraints**:
- No network in `pnpm test`.
- `.env` is never read by tests or by the implementing agent.
- The key never appears in logs, the ledger, errors or the transcript.

**Scale/Scope**: One user and one conversation per run. About 15 source files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass, one exception | Agent, transport, catalogue, pricing, widgets, faux provider all come from pi. No coding-agent tools or context files are used. The exception (key file) is listed under Complexity Tracking |
| II. Wrap pi behind our types | Pass | Only `engine/src/chat-session.ts` and `engine/src/models.ts` import pi-ai or pi-agent-core. The engine exports `ChatSession`, `ModelInfo`, `UsageRecord` and similar types of its own. `tui` uses pi-tui directly, which the constitution allows |
| III. Mechanism, not policy | Pass | Provider errors are classified by status code and shown; no retry heuristics are added |
| IV. Lossless ecosystem data | N/A | No cards in this feature |
| V. SDD development usage accounting | Pass | Development tool invocations and available platform token totals are recorded in development-usage.md. Unavailable token counts are marked unknown. Application usage follows FR-019–FR-023 |
| VI. MVP first | Pass | No sessions, cards, themes or multiple providers |
| VII. Understandable over clever | Pass | Small single-purpose modules, no abstractions without two uses, and pi's `chat-simple.ts` example as the structural template |
| Testing policy | Pass | See the Test Plan below; pi's own behaviour is not re-tested |

Post-design re-check: unchanged, all gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/001-tui-chat/
├── spec.md
├── plan.md              # this file
├── research.md          # pi 1.3.0 facts and decisions (read this first)
├── data-model.md
├── contracts/cli-and-files.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code

```text
packages/data/src/
├── paths.ts              # resolveAppPaths(env): env-paths or LITTLETAVERN_HOME
├── credentials.ts        # readSavedKey / saveKey / forgetKey, mode 0600, permission warning
├── settings.ts           # readSettings / writeSettings ({ model })
├── usage-ledger.ts       # UsageRecord type, appendUsageRecord, readUsageRecords
├── logger.ts             # createLogger(file) + scrubSecrets(text, secrets)
└── index.ts

packages/engine/src/
├── api-key.ts            # resolveApiKey({ envValue, savedValue }) -> ActiveKey | null; isBlank; maskKey
├── models.ts             # (pi) allowed OpenRouter models -> ModelInfo[]; DEFAULT_MODEL_ID; findModel
├── system-prompt.ts      # DEFAULT_SYSTEM_PROMPT (text from spec FR-012)
├── usage.ts              # toUsageRecord(...) mapping rules (research R6); sumUsage(records)
├── provider-errors.ts    # describeProviderError(message) -> { kind, text }
├── chat-session.ts       # (pi) wraps Agent: send, abort, onDelta/onDone/onError; `simulated` option
└── index.ts

packages/tui/src/
├── cli.ts                # --version / --help / start app; restores the terminal on any exit
├── app.ts                # builds the TUI, owns the state machine (data-model.md)
├── theme.ts              # node:util styleText-based themes for Editor/Markdown/SelectList
├── version.ts            # reads packages/tui/package.json
└── components/
    ├── masked-key-input.ts   # research R4
    ├── key-prompt.ts         # masked input + "save / this session only" choice + path notice
    ├── model-picker.ts       # overlay: filter Input + SelectList (fuzzyFilter)
    └── status-bar.ts         # model, key source, totals (incomplete marker)
```

Tests sit next to the code as `*.test.ts`, matching the existing `packages/data/src/index.test.ts`.
The placeholder `PACKAGE_NAME` constants and their smoke test are removed.

**Structure Decision**: Keep the existing three-package workspace. `data` holds files and formats,
`engine` holds pi-wrapping logic with no UI, and `tui` holds pi-tui screens. Only two engine files
import pi, which keeps the anti-corruption layer obvious.

**Structural reference for the implementer**: `../pi/packages/tui/test/chat-simple.ts` (about 130
lines) shows the exact TUI/Editor/Markdown wiring this app needs. Start from its shape.

## Test Plan (complexity-assessed)

| # | Test | Level | Complexity | Decision |
|---|---|---|---|---|
| T-a | Key resolution: env beats saved; blank env or blank input counts as absent; masking shows the last 4 | unit (engine) | low | **write** |
| T-b | Credentials file: save creates mode 0600; read warns on a wider mode; forget removes the key; a malformed file is reported | unit (data, temp dir) | low | **write** |
| T-c | Model filter: only `openai/` and `google/gemini`, no `:batch` or `-image`; the default exists; an unknown remembered id falls back | unit (engine) | low | **write** |
| T-d | Usage mapping: completed, interrupted and error map correctly; unknown is `null`, not 0; no price means cost `null` | unit (engine) | low | **write** |
| T-e | `sumUsage` equals the sum of records; `incomplete` flag | unit (engine) | low | **write** |
| T-f | Secret scrubbing: the key never appears in a ledger line or a log line, including in error text | unit (data) | low | **write** |
| T-g | Provider error classification: 401/403 key rejected, 402 credit, 429 rate limit, network, 404 model | unit (engine) | low | **write** |
| T-h | Happy path, engine level: `ChatSession` with `simulated` replies streams deltas, finishes, and appends one ledger record; history is sent on the second turn | integration (engine, faux) | medium | **write** |
| T-i | Happy path, UI level: build the app with a stub terminal and the simulated model, check that `render(width)` contains the title, simulate typing a key and a message, and check the reply text renders | integration (tui) | medium-high | **try**; if it needs more than about 60 lines of harness, record it as deferred in the report and skip |
| T-j | `--version` prints `LittleTavern 0.1.0` | smoke (spawn the built CLI) | low | **write** |
| T-k | Live: one message to `openai/gpt-4o-mini` produces a reply and a ledger record with a non-null cost | live, opt-in | low | **write**, excluded from `pnpm test` |

**Deferred up front** (manual only): rendering details, resizing, CJK width, picker feel,
terminal restore after a crash. These are pi-tui behaviour or look and feel.

## Complexity Tracking

| Exception | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Own key file module instead of pi's `AuthStorage` (constitution I) | The spec requires showing the path, consent to save, "session only", and a warning on wider permissions | `AuthStorage` lives in coding-agent, adds locking and OAuth we do not use, and still needs all of the above around it. About 40 lines of our own code is easier to explain |
