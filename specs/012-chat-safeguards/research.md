# Research: Chat Safeguards

Verified on 2026-10-20 against branch `012-chat-safeguards` (with `main` at `1769fb8` merged in)
and pi `v1.3.0`. Every fact cites the line it was read from.

## R1. Passing request options (reply cap and sampling)

- **Facts**:
  - `AgentOptions` (`../pi/packages/agent/src/agent.ts:114–141`) has no `maxTokens`,
    `temperature` or `samplingParams`.
  - Every model call goes through `streamFn`. The loop calls
    `streamFunction(config.model, llmContext, { ...config, apiKey, signal })`
    (`agent-loop.ts:403–407`).
  - `StreamFn`'s third argument is `SimpleStreamOptions` (`agent/src/types.ts:33–37`), which
    extends `StreamOptions` (`ai/src/types.ts:369`). `StreamOptions` has `temperature`,
    `samplingParams` and `maxTokens` (`ai/src/types.ts:224–233`).
  - `ChatSession` passes `streamFn: this.models.streamSimple.bind(this.models)`
    (`packages/engine/src/chat-session.ts`, Agent constructor).
  - OpenRouter serves our models through the `openai-completions` adapter
    (`ai/src/providers/openrouter.ts:2,62–79`). That adapter:
    - sends `maxTokens` as `max_completion_tokens` (or `max_tokens` where required) (`ai/src/api/openai-completions.ts:844–849`);
    - sends `temperature` (`:853–854`);
    - merges `samplingParams` last, as raw body keys (`:1005–1009`).
  - The allowed models are `openai/*` and `google/gemini*` (`packages/engine/src/models.ts:25`).
    A runtime check through pi's registry (`createModels` + `openrouterProvider`, as `ChatSession`
    does) returned `api: "openai-completions"` for `google/gemini-2.5-flash`,
    `google/gemini-2.5-pro`, `openai/gpt-4o-mini` and `openai/gpt-5` on 2026-10-20. The
    Anthropic adapter, which ignores `samplingParams`, is never used.
- **Decision**:
  - `ChatSessionOptions` gains `request?: { maxTokens?: number; temperature?: number;
    samplingParams?: Record<string, number> }`.
  - `ChatSession` wraps `streamFn` as
    `(model, context, options) => this.models.streamSimple(model, context, { ...options, ...request })`.
  - Settings names map to body keys: `topP → top_p`, `topK → top_k`, `minP → min_p`,
    `repetitionPenalty → repetition_penalty`. `temperature` uses the named field.
  - The values are read once at start (spec edge case: restart after editing).
  - `ChatSession` exposes `get request()` for the trace (R9).
- **Alternatives**: `prepareRequest` (`agent-loop.ts:212`) can change the context and model, but
  not the stream options; wrapping `streamFn` is simpler.

## R2. A reply cut off by the reply cap

- **Facts**:
  - `StopReason` includes `"length"` (`ai/src/types.ts:474`). The OpenAI adapter maps
    `finish_reason: "length"` to it (`openai-completions.ts:1573–1574`).
  - `ChatSession.run()` maps only `aborted` and `error`; everything else, including `length`,
    becomes `"completed"` (`chat-session.ts`, `run()`).
- **Decision**:
  - `TurnResult` gains `cutOff: boolean`, true when `stopReason === "length"`. The outcome stays
    `"completed"`, so the reply is saved as an ordinary reply (FR-007).
  - The app shows the cut-off note once per run.

## R3. Run spend and unknown prices

- **Facts**:
  - The app keeps this run's `records` and shows `sumUsage(records)` in the status bar
    (`packages/tui/src/app.ts:345, 652–653`). `sumUsage` adds `record.cost?.total`
    (`packages/engine/src/usage.ts:46–70`).
  - `cost` is `null` when the model's price is unknown or zero (`usage.ts:24–26, 38`).
  - `incomplete` is also set when token counts are unknown, for example after an error
    (`usage.ts:63–69`).
- **Decision**:
  - Run spend = `sumUsage(records).cost`.
  - "Prices unknown" (FR-008) means the **current model** has no known price
    (`findAllowedModel(model)?.price` is null or zero), not `incomplete`, because errors also set
    `incomplete`.
  - The spec's assumption is corrected to say this.

## R4. Spend cap check

- **Decision**:
  - The app keeps `runCap` (from settings; 0 means off) and `allowedSpend`, which starts at
    `runCap`.
  - Before a character-chat send, a regenerate (including Ctrl+R) and an innkeeper send: if
    `runCap > 0` and run spend ≥ `allowedSpend`, the app shows a two-entry picker, `Continue` and
    `Stop`, with the contract title.
    - `Continue` adds `runCap` to `allowedSpend` and proceeds.
    - `Stop` restores the typed text to the editor and sends nothing.
  - A reply in progress is never stopped by the cap (spec edge case).

## R5. Errors: log, notice, partial text, retry count

- **Facts**:
  - On an error turn, the app shows `describeProviderError(...)`: friendly text for `401/403`,
    `402`, `429`, `404` and network errors, else `Provider request failed: <message>`
    (`packages/engine/src/provider-errors.ts`). It then logs
    `logger.error({ error: turn.errorMessage }, "Provider request failed")` (`app.ts`, `onFinish`).
  - The logger removes secrets from every argument (`packages/data/src/logger.ts:12–33`) and pino
    adds `time`.
  - The partial text stays on screen through `reply.setText` (`app.ts`, `onFinish`). For
    character chats an error turn is not saved
    (`character-chat.ts:332`: `if (turn && turn.outcome !== "error")`). The user message is
    saved, and `regenerate()` with target `"user"` fills the missing reply
    (`character-chat.ts:248–266`).
  - The log path is `paths.logFile`.
- **Decisions**:
  - The log entry adds `model` and `kind`:
    `logger.error({ error, model, kind }, "Provider request failed")`.
  - On an error, the reply text becomes `<partial> (incomplete, not saved)`. With no partial
    text, only the marker is shown.
  - Notices by `kind` (exact texts in the contract):
    - `key-rejected`, `no-credit` and `model-unavailable` name their fix;
    - `rate-limited`, `network` and `other` give the retry hint with the short reason and the
      count.

    Every notice ends with the log path.
  - **Retry count** (in the app): `retries` is `null` after a success or a new send. A failure
    of a fresh send sets it to `0`. A failure of a regenerate that retried a failed message
    (target `"user"` right after a failure) sets it to `retries + 1`. The notice shows
    `Retries so far: <n>`.
  - **Innkeeper**: `/regenerate` and Ctrl+R work only in character chats (`app.ts`,
    `regenerate()`). The innkeeper notice therefore says to send the message again, and has no
    count. This is recorded as a plan-time clarification in the spec. The innkeeper is
    redesigned in 013.

## R6. `/prev` and the session tree

- **Facts**:
  - `regenerate()` calls `manager.branch(leaf.parentId)` and then generates, so the old reply
    stays in the file as a sibling (`character-chat.ts:248–257`).
  - In pi, `branch(id)` **only moves the in-memory leaf pointer**; it writes nothing
    (`../pi/packages/coding-agent/src/core/session-manager.ts:1579–1584`).
  - When a file is loaded, the leaf becomes the **last entry in the file**
    (`session-manager.ts:1104–1112`).
  - `history()` follows the branch from the leaf (`character-chat.ts:234–235`,
    `getBranch()`).
  - The manager keeps the tree in memory. A file edited while the app runs is not reloaded, so
    such edits cannot be detected and are unsupported. After a restart nothing is kept (spec edge
    case).
- **Consequence**: if `/prev` only moved the leaf to the old sibling, a restart would show the
  newer reply again, which breaks FR-011.
- **Decision**:
  - `CharacterChat` keeps `replaced?: AssistantMessage`, the reply that the latest successful
    regenerate replaced (outcome `completed` or `interrupted`, because both are saved).
  - `prev()`:
    1. if there is no `replaced`, or the leaf is not an assistant reply, return
       `"nothing-to-restore"`;
    2. otherwise, take the current leaf reply, `branch(leaf.parentId)`, and append a copy of
       `replaced` (`appendMessage`). The copy becomes the last entry, so it is still the current
       reply after a restart;
    3. set `replaced` to the reply just swapped out.
  - `send()` and the start of `regenerate()` clear `replaced`. Only a regenerate that completes
    or is interrupted (and so is saved) sets it to the reply it replaced. A failed regenerate
    leaves it cleared (spec FR-010: A → B → C keeps B). A new `CharacterChat`, after a
    chat switch or a restart, starts with none.
  - Each `/prev` adds one entry to the session file. The file is append-only, so this is the
    only way to make the choice persist.
- **Alternatives**: moving the leaf only (lost on restart); a custom "active leaf" entry (pi does
  not read it when loading).

## R7. Streaming refusals for `/prev` and `/new`

- **Facts**:
  - While a reply streams, `editor.disableSubmit = true` (`app.ts`, `stream()`).
  - pi's editor then **ignores Enter** (`../pi/packages/tui/src/components/editor.ts:909–910`).
  - So `submit()` is never reached, and 011's "Wait for the reply, or press Esc to stop it."
    for `/new` is only reachable from tests, not in the real app.
- **Decision**: in the app's input listener (`app.ts`, `tui.addInputListener`), while
  `session.isStreaming`, if the key is Enter and the trimmed editor text is `/new` or `/prev`,
  show that message and consume the key. This fixes the 011 gap and covers `/prev`.

## R8. The player name

- **Facts**:
  - `DEFAULT_USER_NAME = "User"` (`packages/engine/src/assembly/types.ts:77`).
  - `resolveNames` uses `persona?.name ?? userName ?? DEFAULT_USER_NAME`
    (`assembly/macros.ts:3–10`).
  - `settings.userName` exists and is validated as a non-blank string (`data/src/settings.ts:41`).
    It is read for requests and greetings (`character-chat.ts:78, 93`).
  - The chat layout opens in `enterChat()` (`app.ts:143`).
- **Decisions**:
  - `DEFAULT_USER_NAME` becomes `"Traveler"`. Esc on the prompt then needs no special state: the
    default is already "Traveler", and nothing is saved, so the prompt returns next start.
    "User" never appears (SC-004).
  - A `NamePrompt` component, an `Input` prefilled with `Traveler`, opens through `showPanel` in
    `enterChat()` when `userName` is absent and `readActivePersona(paths).persona` is null
    (`packages/data/src/personas.ts:72`; a missing or invalid persona file counts as none, spec
    FR-012). It opens
    before the setup notice.
    - Enter: `stripControls`, trim; empty gives the contract message and keeps the prompt open;
      otherwise `writeSettings({ userName })`.
    - Esc: close.
  - Tests that expect "User" are updated to "Traveler".

## R9. Settings and the trace

- **Facts**: `readSettings` validates each field and silently drops invalid ones
  (`data/src/settings.ts:36–52`). It has no warnings.
- **Decision**: a new `readRequestSettings(paths)` in `packages/data/src/settings.ts` returns
  `{ replyTokens, runSpendUsd, generation, warnings }`:
  - `limits.replyTokens`: a whole number ≥ 0, default 4096;
  - `limits.runSpendUsd`: a number ≥ 0, default 1;
  - `generation.temperature`: 0–2;
  - `generation.topP`: 0–1;
  - `generation.topK`: a whole number ≥ 1;
  - `generation.minP`: 0–1;
  - `generation.repetitionPenalty`: > 0.

  An invalid value is dropped (a limit falls back to its default) and adds a warning such as
  `Ignored generation.temperature in settings.json: must be a number from 0 to 2.` The app shows
  the warnings once at start, like the other startup notices.
- **What pi does with the options**: `buildBaseOptions` sets
  `maxTokens: clampMaxTokensToContext(model, context, options?.maxTokens ?? model.maxTokens)`, and
  merges the model's own `samplingParams` under ours (`../pi/packages/ai/src/api/simple-options.ts:36–46`;
  called from `openai-completions.ts:738–756`). So without our cap, the model's maximum is
  requested, and any cap may be lowered to fit the context. The trace therefore reports what
  LittleTavern **requested** (spec FR-017). `maxTokens` is only passed when `replyTokens > 0`,
  because the adapter treats 0 as "not set" (`openai-completions.ts:844`).
- **Trace**:
  - `CharacterChat.generate()` records `session.request` on `lastTrace` as `request`.
  - `formatTraceReport` adds one line after the header: `Request: max <n> output tokens ·
    temperature 1.1 · top_p 0.9`, or `Request: model defaults` (`no reply limit` when 0).
  - The innkeeper has no trace, so nothing changes there.

## R10. Reply reserve

- **Fact**: assembly reserves `replyReserve` tokens for the reply, default 4000
  (`assembly/types.ts:75`, `assemble.ts:22, 63`).
- **Decision**: when `replyTokens > 0`, assembly reserves
  `max(replyReserve, replyTokens)`, so that a full-length reply still fits the context window.
  The default 4096 raises the reserve by 96 tokens.

## R11. Reminder line

- **Facts**:
  - The home screen shows the key status (`packages/tui/src/components/home-screen.ts:22–30`).
  - The pre-chat setup notice lists `setupSteps()` (`app.ts`, `setupSteps` and
    `updateSetupNotice`).
- **Decision**:
  - `HomeScreen` gains a `limits` line under the key status.
  - `updateSetupNotice` appends the same line while `!chat && !innkeeperSelected`. Once either is
    true, the line is gone (FR-009).
  - The text comes from one function, `formatLimits(settings, settingsFile)`, defined in the
    contract.
