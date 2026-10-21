# Research: The Innkeeper

Facts were read from the code at `main` 4d8fd4d (after 013 merged) and from `../pi` at tag `v1.3.0`. `agent/` means
`../pi/packages/agent/src/`, `ai/` means `../pi/packages/ai/`.

## R1. Tools in pi-agent-core

- **Facts**:
  - A tool is an `AgentTool`: `name`, `description`, `parameters` (a typebox schema), `label`,
    and `execute(toolCallId, params, signal, onUpdate)` returning `{ content, details, isError?,
    terminate? }` (`agent/types.ts:424–446`, `:466–496`). pi validates the arguments against the
    schema before `execute`.
  - pi-ai re-exports typebox's `Type`, `Static` and `TSchema` (`ai/src/index.ts:1–2`). The engine
    already depends on pi-ai, so no dependency is added.
  - `toolExecution` can be `"sequential"` (`agent/types.ts:47`, `agent/agent.ts:253`). The
    default is `"parallel"`.
  - `finishTurn(turn)` runs after each assistant turn and its tool results. `{ action: "end" }`
    ends the run (`agent/types.ts:146–158`, `agent/agent-loop.ts:285–293`). `turn.toolResults`
    holds that turn's tool result messages, with their `details`.
  - The loop executes tool calls whenever the assistant message contains them, whatever the
    stop reason, except `"length"`, where all of them fail (`agent-loop.ts:259–272`).
  - Events include `message_end` for every message, and `tool_execution_start` with the
    `toolName` and `args` (`agent/types.ts:519–532`).
- **Decision**:
  - Tools execute **sequentially**, because two confirmations must never be open at once.
  - Confirmation happens **inside the tool's `execute`**, not in `beforeToolCall`. The tool first
    validates, so invalid values never reach the player (spec US2 scenario 4). Then it asks, and
    returns either "declined" or the result. Keeping it in one place is easier to follow
    (constitution VII).
  - The round limit and "a chat was opened" both end the run through `finishTurn`: one
    `finishTurn` counts the turns that had tool results, and checks for a result whose
    `details.endTurn` is true.
- **Alternative considered**: confirming in `beforeToolCall` (the note from before 010). It
  would split validation and confirmation across two places. Rejected.

## R2. Every allowed model can call tools

- **Fact**: pi's OpenRouter catalog skips models without `"tools"` in their supported parameters
  (`ai/scripts/openrouter-catalog.ts:40`). `listAllowedModels()` filters that catalog
  (`packages/engine/src/models.ts:18–38`).
- **Decision**: no per-model check (spec assumption).

## R3. Where the innkeeper lives: a second agent inside `ChatSession`

- **Facts**:
  - `ChatSession` has one `Agent` with `tools: []`. `send()` (the innkeeper) and `generate()`
    (character chats) share it. `generate()` swaps the messages out and back so the plain chat
    survives (`packages/engine/src/chat-session.ts:128–145`, `:193–208`).
  - The app uses one `session` for both: `onDelta`, `onFinish`, `abort`, `setModel`,
    `isStreaming`, `send` and `clearConversation` (`packages/tui/src/app.ts:153`, `:726–732`,
    `:809`, `:867`, `:889`, `:1055`, `:1147`, `:1154`, `:1174`).
  - `run()` reports only the final assistant message's usage (`chat-session.ts:238–271`, usage at `:264`).
- **Decision**:
  - `ChatSession` owns **two** `Agent`s built from the same model registry and `streamFn`: the
    character agent (`tools: []`, used by `generate()`) and the innkeeper agent (`tools` from the
    options, `toolExecution: "sequential"`, the `finishTurn` from R1, used by `send()`).
  - Both agents' events feed the same `onDelta` listeners and a new `onToolCall` listener.
    `isStreaming`, `abort()` and `setModel()` cover both. The app keeps its single `session`, so
    its wiring barely changes.
  - Because the agents are separate, `generate()` no longer needs to swap messages. Remove the
    swap.
  - `run()` sums `usage` (tokens and cost) over every assistant `message_end` of the run.
    `TurnResult.usage` is that sum. A character turn has one message, so nothing changes for it.
  - `TurnResult` gains `toolLimitReached?: boolean`.
- **Alternative considered**: a separate `Innkeeper` class with its own events. The app would
  need two sets of subscriptions, two busy checks and two aborts. Rejected as more wiring for the
  same behaviour.

## R4. The tools are built in the engine, with the app's callbacks

- **Facts**:
  - The dependency rule is tui → engine → data (constitution). `helpText()` lives in
    `packages/tui/src/commands.ts:33`, so the engine cannot call it.
  - The app opens chats (`startChat`, `setCharacterChat(CharacterChat.resume(...))`,
    `app.ts:441–461`, `:667`) and shows pickers.
- **Fact**: constitution II requires the public APIs of `engine` to expose only LittleTavern
  types, with pi imports confined to adapter modules. `AgentTool` is a pi type
  (`../pi/packages/agent/src/types.ts:466`), so neither `ChatSessionOptions` nor an exported
  function may carry it (analysis C1).
- **Decision**: `createInnkeeperTools(context)` in a new `packages/engine/src/innkeeper-tools.ts`
  returns the six tools as `AgentTool[]`. It is an adapter module like `chat-session.ts`: it is
  **not** exported from the engine barrel, and only `ChatSession` and the engine's own tests
  import it. `context` is an `InnkeeperToolContext`, a LittleTavern type (data-model.md):
  - `paths`;
  - `help(): string`, the app's help text plus the import folders, the settings file and the
    backups folder (spec FR-014);
  - `requestSettings(): RequestSettings`, the request settings the app is using now (R7), so
    `read_settings` reports the values in use (analysis I1);
  - `confirm(request, signal): Promise<boolean>`, where the app shows the question; an abort
    closes it and resolves `false`;
  - `openChat(item, sessionPath?)`, where the app records the request and opens the chat after
    the run ends (R8);
  - `applied(changes, backupPath)`, where the app applies confirmed changes to its in-memory
    state and shows the saved notice with the backup path (R7; analysis U1).

  The app passes the context to `ChatSession` through a new `innkeeper?: InnkeeperToolContext`
  option; `ChatSession` calls `createInnkeeperTools` for its innkeeper agent. Without the option,
  the innkeeper agent has no tools. The round limit comes through `toolRounds`, with a setter for
  live changes. The TUI never sees a pi tool type.

## R5. The tools

| Name | Label (the muted line) | Arguments | Result |
|---|---|---|---|
| `read_settings` | `checked the settings` | none | JSON: `model`, `userName`, active persona name (from the file); `limits` (`replyTokens`, `runSpendUsd`, `toolRounds`) and `generation` (set values) from `context.requestSettings()`, the values in use; lore settings from the file (effective, `DEFAULT_ASSEMBLY_SETTINGS` for unset; they are read on every request); `mouse` from the file; the settings file path. Built field by field; never the credentials |
| `list_characters` | `looked at the guest book` | none | `[{ id, name }]` from `listLibrary` |
| `list_personas` | `looked at the personas` | none | `[{ name, active }]` from `listPersonas` and `settings.persona` |
| `get_help` | `read the house rules` | none | `context.help()` |
| `change_settings` | `proposed a settings change` | `{ changes: [{ setting, value }] }`; `setting` is one of the FR-005 keys; `value` is a number, a boolean, or `null` (remove; `generation` and lore keys only) | validates all, then confirms, then writes (R6) and calls `applied(changes, backupPath)`. Returns the saved values and the backup path, `declined`, or the rule that failed (`isError`) |
| `open_chat` | `offered to open a chat` | `{ character, mode: "new" \| "resume" }`; `character` is a name or library id | resolves the character (R8), confirms, calls `openChat`, returns with `details.endTurn: true`. Unknown, ambiguous or no saved chat: an error result, nothing asked |

## R6. Writing settings safely

- **Facts**:
  - `writeSettings` merges **shallowly**: `{ ...readFile(paths), ...patch }`
    (`packages/data/src/settings.ts:125–129`). Writing `{ limits: { replyTokens } }` would drop
    `limits.runSpendUsd`.
  - `readFile` returns `{}` for a missing **or malformed** file (`settings.ts:85–94`). Writing
    after a malformed read would replace the file with only the new values.
  - The validation rules live in `readRequestSettings` (`settings.ts:32–82`) and `readSettings`
    (`settings.ts:104–122`).
- **Decision**: a new `updateSettings(paths, changes): { backupPath: string | null }` in
  `packages/data/src/settings.ts`:
  1. If the file exists, read and parse it **strictly**. Invalid JSON or a non-object → throw
     `settings.json is not valid JSON. Fix or remove it first.`. Nothing is written.
  2. If the file exists, copy it to `<configDir>/backups/settings-<YYYYMMDD-HHMMSS-mmm>.json`
     with an exclusive create. On a name clash, add `-1`, `-2` and so on. Backups are never
     overwritten (FR-007). With no file, there is nothing to back up, and `backupPath` is `null`.
  3. Apply each change to the parsed object. Dotted keys set a field inside the section,
     creating the section if needed. `null` deletes the field.
  4. Write the file.
- A shared `checkSettingChange(setting, value): string | null` returns the rule text for an
  invalid value. `readRequestSettings` and `readSettings` use the same rule table, so the ranges
  cannot drift.
- `readRequestSettings` gains `toolRounds` (`limits.toolRounds`, whole number ≥ 1, default 5),
  with the 012 warning format.

## R7. Applying a change immediately

- **Facts**:
  - The app builds the request options from `requestSettings` once (`app.ts:116–139`) and
    passes them to `ChatSession`.
  - `CharacterChat` passes `session.request.maxTokens` to assembly (`character-chat.ts:413`).
  - The lore settings are read from `settings.json` on every request (`character-chat.ts:77–79`).
  - `mouse` is a terminal option at start (`app.ts:160`).
  - The spend check uses `requestSettings.runSpendUsd` and `allowedSpend` (`app.ts:795–797`);
    the cut-off note uses `requestSettings.replyTokens` (`app.ts:785–791`).
- **Decision**:
  - Move the request building into a function `buildRequest(requestSettings)`.
  - `applied(changes)` updates the in-memory `requestSettings` with **only the confirmed
    changes**, then calls `session.setRequest(buildRequest(requestSettings))`.
  - For `runSpendUsd`, it sets `allowedSpend` to the new value. For `toolRounds`, it calls
    `session.toolRounds = n`.
  - The lore settings need nothing. For `mouse`, it shows the restart notice.
  - It shows the saved notice with `backupPath` (contract), then the mouse notice if any.
  - `requestSettings` gains `toolRounds` (R6), so the context's `requestSettings()` returns the
    app's in-memory object, which holds every limit in use.
  - Hand edits to `limits`, `generation`, `model` and `mouse` made while the app runs are not
    applied this way; they wait for a restart. The lore settings, `userName`, the persona and
    lorebook attachments are read on every request (`character-chat.ts:63–79`), so hand edits
    to them apply at once, as today (spec edge case; analysis I2).

## R8. Opening a chat from inside a run

- **Facts**:
  - `startChat(item)` and `setCharacterChat()` clear the transcript and switch `chat`
    (`app.ts:441–461`).
  - `onFinish` records usage under `chat?.sessionId ?? sessionId` (`app.ts:734–738`). Switching
    during the run would file the innkeeper's usage under the character chat.
  - `listChats` returns saved chats, newest first, without the library id
    (`character-chat.ts:163–176`). `readChatCharacter(paths, path)` gives it
    (`character-chat.ts:152–157`).
- **Decision**:
  - The `openChat` callback only records `pendingOpen`. After `stream()` returns for an innkeeper
    send, the app opens it: `startChat(item)` for `"new"`, or `setCharacterChat(
    CharacterChat.resume(...))` for `"resume"`.
  - The tool resolves the character case-insensitively. An exact id or name wins. Otherwise a
    unique substring match is used. Several matches → an error listing them. None → an error
    listing all names.
  - For `"resume"`, it walks `listChats` and takes the first chat whose `readChatCharacter`
    library id matches. With none → an error result: "no saved chat".

## R9. Showing the innkeeper's work

- **Facts**:
  - The app streams into one `reply` view per send (`app.ts:703–731`).
  - `/innkeeper` clears the transcript (`app.ts:1142–1149`). The agent's messages survive, so
    the screen and the model's view differ today.
  - The input listener aborts on Esc whenever a reply streams (`app.ts:1281–1285`), even with an
    overlay open.
- **Decision**:
  - On `onToolCall`, the app removes the current reply view if it is still empty, adds the muted
    line `Innkeeper <label>` (contract), and starts a new empty reply view for the text that
    follows.
  - `ChatSession.innkeeperHistory()` returns `{ kind: "user" | "innkeeper" | "tool", text }`
    items from the innkeeper agent's messages. User text and assistant text become items, each
    tool call becomes a `tool` item with its label, and tool results are skipped. `/innkeeper`
    renders them; `tool` items render as the muted line.
  - While a confirmation is open, Esc goes to the picker (No) instead of aborting.

## R10. The innkeeper's instructions

- **Decision**: a new `INNKEEPER_SYSTEM_PROMPT` in `packages/engine/src/system-prompt.ts`,
  replacing the generic roleplay prompt that the plain chat used. It says:
  - you keep the tavern and guide guests through LittleTavern;
  - every fact about the app or the guest's setup comes from your tools; call them instead of
    guessing;
  - answer in the guest's language;
  - you can change only the settings your change tool accepts. Each change is shown to the guest
    for approval;
  - for the model, the persona, lorebooks or the name characters use, name the command
    (`/model`, `/persona`, `/lorebooks`), and explain that a persona's name replaces the default
    name;
  - you cannot see or change the API key; point to `/apikey`;
  - keep replies short.

  The full text is in `contracts/messages.md`.
