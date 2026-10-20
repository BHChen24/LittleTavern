# Research: TUI Chat Skeleton

All facts below were verified against `../pi` checked out at tag `v1.3.0` (the pinned version), and
against the installed `@earendil-works/pi-ai@1.3.0` model catalogue, on 2026-10-19.

## R1. Agent loop: pi-agent-core `Agent`, not coding-agent

- **Decision**: Use `Agent` from `@earendil-works/pi-agent-core` directly, with
  `streamFn: models.streamSimple.bind(models)` from pi-ai. Do not use `pi-coding-agent` in this
  feature.
- **Rationale**: In pi 1.x, `pi-agent-core` contains only `Agent`, the agent loop and their types
  (AgentHarness, sessions and compaction were removed in 1.0.0). `Agent` already gives us message
  state, streaming events (`subscribe`), `prompt(text)`, `abort()` and `waitForIdle()`. A plain
  chat needs nothing more. `createAgentSession` from coding-agent brings settings, resource
  loading and tools that this feature would have to switch off.
- **Verified API** (`packages/agent/src/agent.ts`, `README.md`):
  `new Agent({ initialState: { systemPrompt, model }, streamFn, getApiKey })`;
  `agent.subscribe(listener)`; `agent.prompt(text)`; `agent.abort()`. Text arrives as
  `event.type === "message_update"` with `event.assistantMessageEvent.type === "text_delta"`.
- **Alternatives**: coding-agent `createAgentSession` (rejected for 001; revisited in 004 for
  `SessionManager`); hand-rolled stream loop (rejected by constitution I).

## R2. Provider and model catalogue

- **Decision**: `createModels()` from pi-ai, then `models.setProvider(openrouterProvider())`
  (`@earendil-works/pi-ai/providers/openrouter`). The allowed list is
  `models.getModels("openrouter")` filtered to ids starting with `openai/` or `google/gemini`,
  excluding ids that contain `:` (batch variants) or `-image`. Use the built-in offline catalogue;
  do not call `models.refresh()`.
- **Rationale**: `getModels()` already returns chat models only (image models are a separate
  type). The catalogue ships with prices. Measured on 1.3.0: 396 OpenRouter chat models, 128 in
  the two families before excluding batch variants, and none of them with a zero price.
- **Default model**: `google/gemini-2.5-flash` (input $0.30, output $2.50 per million tokens,
  1M context). **Live-test model**: `openai/gpt-4o-mini` (the cheapest allowed: $0.15/$0.60).
- **Alternatives**: `personalizeOpenRouterCatalog` / `refresh()` to fetch the user's live model
  list (rejected: network at startup, more failure modes, not needed for a skeleton).

## R3. API key resolution and storage

- **Decision**: We resolve the key ourselves and hand it to the agent via
  `getApiKey: () => currentKey`. Order: non-blank `OPENROUTER_API_KEY` env var, then the saved
  key file, then prompt. Saving is our own small module: a JSON file `{ "openrouter": "<key>" }`
  written with mode `0o600` in a directory created with mode `0o700`.
- **Rationale**: The agent loop passes `getApiKey()`'s result as `options.apiKey`, and pi-ai's
  `Models.stream*` uses `options.apiKey` before any credential store (`models.ts:871`). Keeping
  resolution in our code makes the "where did the key come from" status trivial. pi's file store
  (`AuthStorage` in coding-agent) has locking and OAuth support we do not need, and does not do
  the consent prompt or permission warning the spec requires. Our version is about 40 lines.
- **Constitution I**: this hand-rolls something pi has. It is justified in plan.md's Complexity
  Tracking.

## R4. Masked key input

- **Decision**: A small `MaskedKeyInput` component that owns a pi-tui `Input`, forwards
  `handleInput` to it (so paste, cursor movement and deletion keep working), and renders its own
  line showing `•` for every character except the last four.
- **Rationale**: pi-tui's `Input` has no mask option (`InputOptions` is only
  `prompt`/`placeholder`/`placeholderStyle`). pi's own `LoginDialogComponent` does not mask
  either. Wrapping keeps paste support, which matters most for API keys.

## R5. TUI composition

- **Decision**: `new TuiMainScreen(new ProcessTerminal())` as in pi-tui's
  `test/chat-simple.ts`, which is the reference example for this feature. Components: `Text` for
  the header and status bar, `Markdown` per message (`setText()` while streaming), `Editor` for
  input, `SelectList` plus an `Input` filter inside an overlay (`tui.showOverlay`) for the model
  picker. `tui.addInputListener` handles global keys (Esc interrupts, Ctrl+C quits).
- **Styling**: `styleText` from `node:util` for theme functions. No colour dependency.
- **Note**: `SelectList.setFilter` matches by prefix only. For "type part of a name", filter the
  items ourselves with `fuzzyFilter` (exported by pi-tui) and rebuild the list.

## R6. Usage and cost

- **Decision**: Build one usage record per finished assistant message from pi-ai's
  `AssistantMessage`: `usage` (`input`, `output`, `cacheRead`, `cacheWrite`, optional
  `reasoning`, `totalTokens`, `cost.{input,output,cacheRead,cacheWrite,total}`), `stopReason`,
  `errorMessage` and `durationMs`.
- **Unknown versus zero** (FR-021). pi-ai initialises usage numbers to 0, so "not reported" has
  to be inferred:
  - The token fields are `null` when the outcome is `interrupted` or `error` and `totalTokens`
    is 0.
  - `reasoning` is `null` when pi leaves it `undefined`.
  - The cost is `null` when the model's catalogue price is zero for both input and output.
  - `durationMs` is pi's value, or our own measurement when pi's is absent.
- **Outcome mapping**: `stop` and `length` map to `completed`, `aborted` to `interrupted`, and
  `error` to `error`.
- **Rationale**: pi already computes the cost from catalogue prices, so the ledger only maps
  fields. Inferring "unknown" is a heuristic, which is acceptable under constitution III; it is
  documented here so it can be explained.

## R7. Simulated model for tests

- **Decision**: pi-ai's `fauxProvider({ provider, models })` returns a handle with
  `setResponses([...])` (strings, `fauxAssistantMessage(...)`, or factories). The engine's chat
  session accepts an optional `simulated` option (a list of reply texts plus an optional price)
  and builds a faux provider internally, so no pi type crosses the engine's public API
  (constitution II).
- **Rationale**: The happy path and the ledger tests run with no network and no key.

## R8. Logging

- **Decision**: pino writing to a file (`pino.destination(path)`), never stdout. Redaction is
  two-layered: pino `redact` for known paths (`apiKey`, `key`, `headers.authorization`) plus a
  `scrubSecrets(text, secrets)` helper applied to messages, which replaces every occurrence of the
  active key with `[REDACTED]`.

## R9. Paths

- **Decision**: `env-paths("littletavern", { suffix: "" })` gives the config, data and log
  directories. If `LITTLETAVERN_HOME` is set, all three live under it instead; tests always set
  it to a temporary directory.
- **Files**:
  - `config/credentials.json`: the saved key.
  - `config/settings.json`: `{ "model": "<id>" }`.
  - `data/usage.jsonl`: the usage ledger.
  - `log/littletavern.log`: the diagnostic log.

## R10. Development key in `.env`

- **Decision**: The root `pnpm dev` script runs `node --env-file-if-exists=.env` on the built
  CLI. Only `pnpm dev` and `pnpm test:live` (owner-only) load `.env`, and the default test run
  never does.
- **Rationale**: `--env-file-if-exists` is built into Node 22.9 and later (local Node is 26.7),
  so no dotenv dependency is needed.

## R11. Version shown in the title

- **Decision**: Read `version` from `packages/tui/package.json` at runtime
  (`new URL("../package.json", import.meta.url)`). Set the workspace and package versions to
  `0.1.0`.
