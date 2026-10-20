---
description: "Task list for 001-tui-chat"
---

# Tasks: TUI Chat Skeleton

**Input**: Design documents from `specs/001-tui-chat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-and-files.md,
quickstart.md

**Tests**: Requested by the spec ("Acceptance Testing") and sized by plan.md's Test Plan (T-a to
T-k). Keep them lightweight: our own code only, never pi's behaviour.

**Read before starting**:
- `research.md`: every pi 1.3.0 API used here, already verified.
- `../pi/packages/tui/test/chat-simple.ts`: the structural template for the TUI.

## Rules for this run (unattended)

- **Do not stop to ask.** If something is unclear or contradictory, write it to
  `specs/001-tui-chat/questions.md` (what, where, what you chose), take the most conservative
  option, and continue.
- **Tests too complex?** If a test needs disproportionate harness code (plan.md sets a limit of
  about 60 lines for T-i), record it under "Deferred tests" in the report and move on.
- **Never** read, print or use `.env`. **Never** run `pnpm test:live`. **Never** add a
  dependency. If one seems necessary, record it in `questions.md` and work around it.
- Verify any pi API you are unsure of against `../pi` (checked out at `v1.3.0`). Do not guess.
- After each phase: run `pnpm build && pnpm lint && pnpm test`, then commit with an **English**
  conventional message (`feat:`, `test:`, `chore:`...). Mark the finished tasks `[x]` in this file
  in the same commit.
- Code must be explainable line by line (constitution VII): small functions, plain names, no
  clever abstractions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 to US4 from spec.md

---

## Phase 1: Setup

**Purpose**: Clean the scaffold and add the scripts every later phase relies on.

- [X] T001 Set `"version": "0.1.0"` in `package.json`, `packages/data/package.json`, `packages/engine/package.json` and `packages/tui/package.json`
- [X] T002 Remove the placeholder `PACKAGE_NAME` constants and the smoke test: `packages/data/src/index.ts`, `packages/data/src/index.test.ts`, `packages/engine/src/index.ts`, `packages/tui/src/index.ts` (leave each `index.ts` as an empty barrel to be filled in later)
- [X] T003 Add root `vitest.config.ts` whose default run excludes `**/*.live.test.ts`, `**/dist/**` and `**/node_modules/**`, and `vitest.live.config.ts` that includes only `packages/*/src/**/*.live.test.ts`
- [X] T004 Add root scripts in `package.json`: `"dev": "pnpm build && node --env-file-if-exists=.env packages/tui/dist/cli.js"` and `"test:live"`, which runs vitest with `vitest.live.config.ts` under `node --env-file-if-exists=.env`. Add `.env.example` containing only `OPENROUTER_API_KEY=`

**Checkpoint**: `pnpm build && pnpm lint && pnpm test` pass (with zero test files, configure vitest `passWithNoTests` or keep it green some other way). Commit.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: Paths, logging, key resolution, the model catalogue, error descriptions and the CLI entry.

- [X] T005 [P] Implement `resolveAppPaths(env)` in `packages/data/src/paths.ts`: use `env-paths("littletavern", { suffix: "" })` for config, data and log directories, or put all three under `LITTLETAVERN_HOME` when it is set. Return `configDir`, `dataDir`, `logDir`, `credentialsFile` (`<configDir>/credentials.json`), `settingsFile` (`<configDir>/settings.json`), `usageLedgerFile` (`<dataDir>/usage.jsonl`) and `logFile` (`<logDir>/littletavern.log`). Test the `LITTLETAVERN_HOME` override in `packages/data/src/paths.test.ts`
- [X] T006 [P] Implement `scrubSecrets(text, secrets)` (replace every occurrence of each non-empty secret with `[REDACTED]`) and `createLogger(file, getSecrets)` in `packages/data/src/logger.ts`. The logger is pino writing to a file via `pino.destination`, never stdout, with `redact` for `apiKey`, `key` and `headers.authorization`, and message strings passed through `scrubSecrets`. Test that a logged message and a logged error containing the key do not contain it in the file (T-f, log part) in `packages/data/src/logger.test.ts`
- [X] T007 [P] Implement `isBlank`, `maskKey` (`••••` plus the last 4 characters) and `resolveApiKey({ envValue, savedValue, sessionValue })` returning `{ value, source: "environment" | "saved" | "session", masked } | null` in `packages/engine/src/api-key.ts`. Precedence: non-blank environment, then saved, then session; blank counts as absent. Tests T-a in `packages/engine/src/api-key.test.ts`
- [X] T008 [P] Implement `listAllowedModels()`, `DEFAULT_MODEL_ID = "google/gemini-2.5-flash"` and `findAllowedModel(id)` in `packages/engine/src/models.ts` per research R2. Use `createModels()` and `setProvider(openrouterProvider())`; keep ids starting with `openai/` or `google/gemini`; exclude ids containing `:` or `-image`; return `ModelInfo { id, name, family: "openai" | "gemini", price: { inputPerMTok, outputPerMTok } | null }`. Tests T-c in `packages/engine/src/models.test.ts`
- [X] T009 [P] Add `DEFAULT_SYSTEM_PROMPT` in `packages/engine/src/system-prompt.ts` with exactly: "You are a roleplay assistant. Stay in character, write vivid in-world prose, keep replies to a few paragraphs, and follow the user's lead."
- [X] T010 [P] Implement `describeProviderError(message)` returning `{ kind: "key-rejected" | "no-credit" | "rate-limited" | "model-unavailable" | "network" | "other", text }` in `packages/engine/src/provider-errors.ts`. Classify by 401/403, 402, 429, 404, and network failure words (`fetch failed`, `ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`). Tests T-g in `packages/engine/src/provider-errors.test.ts`
- [X] T011 [P] Add `packages/tui/src/version.ts` (read `version` from `new URL("../package.json", import.meta.url)`) and `packages/tui/src/theme.ts` (Editor, Markdown and SelectList themes built with `styleText` from `node:util`; see the theme shapes in `../pi/packages/tui/test/test-themes.ts`)
- [X] T012 Implement `runCli(argv, out)` in `packages/tui/src/cli.ts`: `--version` prints `LittleTavern <version>`, `--help` prints the usage from `contracts/cli-and-files.md`, and neither starts the TUI. With no flags it starts the app (Phase 3). Smoke test T-j in-process (call `runCli(["--version"], …)`) in `packages/tui/src/cli.test.ts`
- [X] T013 Export the public API from `packages/data/src/index.ts` and `packages/engine/src/index.ts`. **No pi types are re-exported from either.**

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 1 - Launch and chat with a model (P1) 🎯 MVP

**Goal**: With `OPENROUTER_API_KEY` set, the app shows the title and streams a chat.

**Independent Test**: The simulated happy path passes (T-h, and T-i if not deferred). The owner
then checks quickstart steps 3–5 with a real key.

- [X] T014 [US1] Write `packages/engine/src/chat-session.test.ts` (T-h): using `simulated: { replies: ["Hello there.", "You said hi before."] }`, `send()` emits text deltas and then a finish result with `outcome: "completed"`, and on the second `send()` the request includes the first exchange. Also cover `abort()` during streaming, which gives `outcome: "interrupted"` and keeps the partial text
- [X] T015 [US1] Implement `ChatSession` in `packages/engine/src/chat-session.ts`: wrap pi-agent-core `Agent` (research R1) with `initialState: { systemPrompt, model }`, `streamFn: models.streamSimple.bind(models)` and `getApiKey: () => options.getApiKey()`.
  - **Options**: `{ modelId, systemPrompt, getApiKey, simulated? }`. When `simulated` is given, build a pi-ai `fauxProvider` with the scripted replies instead of OpenRouter (research R7). An optional `simulated.price` sets the faux model cost.
  - **API**: `send(text)`, `abort()`, `isStreaming`, `setModel(modelId)`, `onDelta(cb)`, `onFinish(cb)`. `setModel` keeps the history: assign `agent.state.model = model`, which is mutable per `../pi/packages/agent/src/types.ts:391`.
  - **`onFinish` payload**: our own `TurnResult { outcome: "completed" | "interrupted" | "error", text, errorMessage?, model, startedAt, durationMs, usage: { input, output, cacheRead, cacheWrite, reasoning?, totalTokens, cost: { input, output, cacheRead, cacheWrite, total } } }`, mapped from the final `AssistantMessage`. Map `stopReason`: `stop` and `length` → completed, `aborted` → interrupted, `error` → error.
  - Ignore thinking deltas; show text deltas only.
- [X] T016 [P] [US1] Implement `packages/tui/src/components/status-bar.ts`: a one-line `Text` showing the model id, `key: <source>`, and a usage slot that US3 fills in (show `—` until then)
- [X] T017 [US1] Implement `packages/tui/src/app.ts` following `chat-simple.ts`:
  - **Layout**: `TuiMainScreen(new ProcessTerminal())` (or an injected terminal for tests); header `Text` "LittleTavern <version>"; transcript of `Markdown` blocks; `Editor`; status bar.
  - **State**: `ready` / `streaming` (data-model.md state machine). Enter sends non-blank input, and blank input does nothing.
  - **Streaming**: show deltas with `Markdown.setText` and `tui.requestRender()`.
  - **Esc** while streaming calls `abort()` and appends ` [interrupted]` to that reply.
  - **Errors** become a readable transcript line from `describeProviderError`.
  - **Commands and keys**: `/help` opens an overlay listing the commands from `contracts/cli-and-files.md`. `/quit` and Ctrl+C quit (via `tui.addInputListener`).
  - **Terminal restore**: always call `tui.stop()` on exit, including from `uncaughtException`, `SIGINT` and `SIGTERM` handlers.
- [X] T018 [US1] Make the no-flag path of `runCli` in `packages/tui/src/cli.ts` read `OPENROUTER_API_KEY`, the saved settings model (default for now) and `DEFAULT_SYSTEM_PROMPT`, then start `app.ts`. Until US2 lands, a missing key prints a one-line message telling the user to set `OPENROUTER_API_KEY` and exits with code 1
- [X] T019 [US1] Try T-i in `packages/tui/src/app.test.ts`: build the app with a stub `Terminal` (never call `tui.start()`) and the simulated session, then assert that `render(80)` lines contain "LittleTavern", feed keystrokes into the editor, and assert that the reply text renders. **If the harness exceeds about 60 lines, delete the attempt and record T-i as deferred** in the report

**Checkpoint**: checks pass. US1 works with a real key (owner, in the morning). Commit.

---

## Phase 4: User Story 2 - Enter a key inside the app (P1)

**Goal**: There is no dead end without a key. The key is masked, saving requires consent, and a
saved key can be forgotten.

**Independent Test**: T-b and the edge-case tests pass. The owner then checks quickstart steps
1–2, 9 and 10.

- [X] T020 [P] [US2] Implement `packages/data/src/credentials.ts`:
  - `readSavedKey(paths)` returns `{ key: string | null, warning?: "permissions-too-open", error?: string }`. It warns when the file mode allows group or other access, and returns an error for an unreadable file or malformed JSON.
  - `saveKey(paths, key)` creates the directory with mode `0o700` and writes `{ "openrouter": key }` with mode `0o600`.
  - `forgetKey(paths)` removes the `openrouter` field and rewrites with `0o600`.

  Tests T-b in `packages/data/src/credentials.test.ts`, using a temporary `LITTLETAVERN_HOME`.
- [X] T021 [P] [US2] Implement `MaskedKeyInput` in `packages/tui/src/components/masked-key-input.ts` per research R4: own a pi-tui `Input`, forward `handleInput` to it, render `•` for all characters except the last 4, and expose `onSubmit`
- [X] T022 [US2] Implement `packages/tui/src/components/key-prompt.ts`.
  - **Step 1**: explain that an OpenRouter key is needed and where to get one (`https://openrouter.ai/keys`), then show the `MaskedKeyInput`. A blank submit shows "Key cannot be empty" and keeps the prompt open.
  - **Step 2**: show "The key will be saved to `<full credentialsFile path>`, readable only by your user account", then a `SelectList` with "Save" and "This session only".
  - **Result**: `{ key, save: boolean }`.
- [X] T023 [US2] In `packages/tui/src/app.ts`, add the `needs-key` state.
  - **At launch**: call `resolveApiKey` with the environment value and `readSavedKey(...)`. If it returns null, show the key prompt; otherwise go to `ready`. Show `readSavedKey` warnings and errors as transcript notices, then fall back to prompting.
  - **On "Save"**: call `saveKey`. Either way, the entered key becomes the `session` or `saved` source.
  - **CLI**: remove the US1 exit-on-missing-key path from `cli.ts`.
- [X] T024 [US2] In `packages/tui/src/app.ts`:
  - **Rejected key**: when `describeProviderError` returns `key-rejected`, show "OpenRouter rejected the key", keep the transcript, and return to `needs-key`.
  - **`/key`**: opens the key prompt.
  - **`/forget-key`**: calls `forgetKey`. If the environment key is active it stays active; otherwise the state becomes `needs-key`.
- [X] T025 [US2] Extend `packages/engine/src/api-key.test.ts` with the spec's edge cases: an empty environment variable plus a saved key uses the saved key; a whitespace-only environment variable with nothing saved returns null; environment plus saved reports `source: "environment"`

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 3 - See what every request costs (P2)

**Goal**: One ledger line per request, and status bar totals equal to the ledger sum.

**Independent Test**: T-d, T-e and the ledger parts of T-f and T-h pass.

- [ ] T026 [P] [US3] Implement `packages/data/src/usage-ledger.ts`.
  - **Type**: `UsageRecord` exactly as in data-model.md: `v: 1`, `timestamp` (ISO-8601, request start), `sessionId`, `provider: "openrouter"`, `model`, `outcome`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `reasoningTokens` (each "number | null"), `cost` ("{ total, input, output, cacheRead, cacheWrite } | null"), `durationMs` ("number | null"), and an optional `error` that is already scrubbed.
  - **`appendUsageRecord(file, record)`**: creates the directory if missing and appends one `JSON.stringify` line plus `\n`.
  - **`readUsageRecords(file)`**: skips blank lines and ignores unknown fields.

  Tests in `packages/data/src/usage-ledger.test.ts`.
- [ ] T027 [P] [US3] Implement `toUsageRecord(turn, { sessionId, modelPrice, secrets })` and `sumUsage(records)` in `packages/engine/src/usage.ts` with research R6's rules, verbatim.
  - **Tokens**: `null` when the outcome is interrupted or error **and** `totalTokens === 0`.
  - **Reasoning**: `reasoningTokens` is `null` when pi left it undefined.
  - **Cost**: `null` when the model price is null or both input and output prices are 0.
  - **Error**: `error` = `scrubSecrets(errorMessage, secrets)`.
  - **Totals**: `sumUsage` returns `{ requests, inputTokens, outputTokens, cost, incomplete }`, where `incomplete` is true when any record has a `null` cost or `null` tokens.

  Tests T-d and T-e in `packages/engine/src/usage.test.ts`.
- [ ] T028 [US3] Wire the ledger into `packages/tui/src/app.ts`.
  - **Session**: generate `sessionId = randomUUID()` once per run.
  - **Every request**: on every `onFinish` (completed, interrupted or error) build the record with `toUsageRecord`, call `appendUsageRecord`, and update the status bar with `sumUsage` over this session's records. Show tokens as `in/out` and cost as `$0.0123`, with a trailing `~` when incomplete.
  - **Quitting mid-stream**: `abort()`, wait for the finish, record it, then exit.
  - **Local blocks** (no key, blank input) write no record.
- [ ] T029 [US3] Extend `packages/engine/src/chat-session.test.ts`: with the simulated provider and a price, three sends produce three records (one per request), `sumUsage` equals their sum, and an error turn whose message contains the key produces a record without the key (T-f, ledger part)

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 4 - Choose the model (P2)

**Goal**: A filterable picker limited to the allowed families, remembered across launches.

**Independent Test**: The settings test passes. The owner then checks quickstart step 6 and the
relaunch in step 9.

- [ ] T030 [P] [US4] Implement `readSettings(paths)` and `writeSettings(paths, { model })` in `packages/data/src/settings.ts`. A missing or malformed file returns `{}`. Tests in `packages/data/src/settings.test.ts`
- [ ] T031 [US4] Implement `packages/tui/src/components/model-picker.ts`: an overlay with an `Input` filter on top of a `SelectList`. Filter with pi-tui `fuzzyFilter` (prefix-only `setFilter` is not enough, research R5) and rebuild the list. Each item shows `id` and `$in/$out per M` (or `price unknown`). Enter selects, Esc cancels
- [ ] T032 [US4] In `packages/tui/src/app.ts`:
  - **`/model`** (in `ready` only) opens the picker. On select, call `session.setModel(id)`, `writeSettings`, and update the status bar.
  - **At launch**: use `findAllowedModel(settings.model)`. If the stored id is no longer allowed, use `DEFAULT_MODEL_ID` and show a notice naming both.

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T033 [P] Add the opt-in live test (T-k) in `packages/engine/src/chat-session.live.test.ts`: `describe.skipIf(!process.env.OPENROUTER_API_KEY)`, one short message to `openai/gpt-4o-mini`, then assert a non-empty reply and a record with non-null cost. **Write it; do not run it.**
- [ ] T034 Run `pnpm build && pnpm lint && pnpm test` and `node packages/tui/dist/cli.js --version` (quickstart "Automated"). Fix failures
- [ ] T035 Write `specs/001-tui-chat/report.md`. Sections:
  - Summary: what works.
  - Tasks completed and not completed.
  - Test results: the counts and the command output tail.
  - Deferred tests, with the reason for each.
  - Deviations from spec or plan.
  - Open questions: link to `questions.md`, if any.
  - What the owner should check manually: quickstart steps.

  Commit.

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** → **US1** → **US2** → **US3** → **US4** → **Polish**.
  US2–US4 all edit `app.ts`, so run them in order rather than in parallel.
- Inside a phase, `[P]` tasks touch different files and can run in any order.

### Parallel opportunities

- Phase 2: T005, T006, T007, T008, T009, T010 and T011 are independent.
- US2: T020 and T021. US3: T026 and T027. US4: T030 alongside T031.

## Implementation Strategy

1. **MVP**: Setup, then Foundational, then US1. The owner can chat with an environment key and a
   simulated test proves the loop.
2. **US2**: makes the app usable without shell setup. This is the owner's priority for manual
   testing.
3. **US3**: adds the usage ledger, which is a hard v1 requirement.
4. **US4**: adds the model picker.
5. **Polish**: the live test (unrun) and the report.

If time or quota runs out, stop at a checkpoint boundary, commit, and write the report with what
remains.
