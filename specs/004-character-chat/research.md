# Research: Character Chat

These findings were verified on 2026-10-19 against `../pi` at tag `v1.3.0` and the code on
branch `003-prompt-assembly`, which includes 001 and 002.

## R1. Sending an assembled context through the existing `Agent`

- **Decision**: Add one method, `generate(context: ChatContext)`, to `ChatSession` in
  `packages/engine/src/chat-session.ts`. It runs a single turn against the full context it is
  given. `ChatContext` is our own type and contains no pi types:

  ```text
  ChatContext = { system: string; messages: { role: "user" | "character"; text: string }[];
                  afterHistory: string | null }
  ```

  Inside, `generate()` turns the context into pi messages:

  | Context part | pi message |
  |---|---|
  | `system` | a `SystemMessage` |
  | each user message | a `UserMessage` with string content |
  | each character message | a minimal `AssistantMessage` (text content, the current model's `api`/`provider`/`model`, zero usage, `stopReason: "stop"`) |
  | `afterHistory` | a trailing `SystemMessage` |

  The agent's `transformContext` hook returns exactly that list. Before each run, the agent's
  own transcript is cleared (`agent.state.messages = []`), so only the given context counts.
- **Why this is safe**:
  - `transformContext` runs right before `convertToLlm` in the loop
    (`packages/agent/src/agent-loop.ts:390-395`) and replaces the whole message list.
  - The default `convertToLlm` keeps `system` messages (`agent.ts:38-46`).
  - The OpenAI-completions adapter sends a later system message in place, as the
    system/developer role, through `renderSystemMessageUpdate`
    (`packages/ai/src/api/openai-completions.ts:1250-1260`).
- **What we keep from 001**: streaming deltas, Esc interruption, `TurnResult` and the usage
  mapping work unchanged. Plain chat keeps using `send(text)`.
- **Verification test**: 001's simulated-reply factory receives the history. A test asserts that
  the simulated model sees the system text, the history and the post-history system message.
- **Rejected**: calling `models.streamSimple` directly. That would duplicate 001's streaming,
  abort handling and usage code.

## R2. Session files with pi's `SessionManager` (coding-agent)

- **Decision**: Store each character chat with `SessionManager` from
  `@earendil-works/pi-coding-agent`. The package is already pinned at 1.3.0. Its own entry point
  also loads pi-tui, which the owner accepted on 2026-10-19.
- **API used** (`packages/coding-agent/src/core/session-manager.ts`):

  | Call | Purpose |
  |---|---|
  | `SessionManager.create(cwd, sessionDir)` | start a new chat |
  | `SessionManager.open(path, sessionDir)` | resume a chat |
  | `SessionManager.list(cwd, sessionDir)` | list chats (returns `SessionInfo` with `name`, `created`, `modified`, `messageCount`), sorted |
  | `appendMessage(msg)` | append a user or assistant message (returns the entry id) |
  | `appendCustomEntry(type, data)` | append our own record types |
  | `appendSessionInfo(name)` | set the chat's display name |
  | `getBranch()` | the current path from the root to the leaf |
  | `getLeafEntry()` | the last entry on the current path |
  | `branch(entryId)` | move the leaf back, so the next append becomes a sibling |
  | `getSessionId()` | the session identifier |

- **Directories**:
  - `sessionDir`: `<dataDir>/sessions`
  - `cwd`: `<dataDir>`

  Passing the same `cwd` and `sessionDir` every time keeps `list()`'s cwd filter consistent. pi's
  default `~/.pi/agent/sessions` is never used (constitution I).
- **When the file is written**: nothing is written until the first `user` or `assistant`
  message. After that, every record is appended immediately (`_persist`, lines 1172-1188). A chat
  that has only its greeting is therefore not saved, which is acceptable.
- **Record layout** for one chat:

  | Record | Content |
  |---|---|
  | header | written by pi |
  | `custom` `"littletavern.character"` | `{ libraryId, name }`, written first |
  | `session_info` | the character name, used in the list |
  | `custom` `"littletavern.greeting"` | `{ text }`, the greeting after macro replacement |
  | `message` | the user's message (`UserMessage`) |
  | `message` | the reply (`AssistantMessage`, built from `TurnResult`); after an interruption it holds the partial text, `stopReason: "aborted"` and `custom: { interrupted: true }` |

  A failed request appends no assistant entry, so the user message stays at the leaf.
- **Regenerate**:
  - If the leaf is an assistant message, call `branch(leaf.parentId)` and generate; the new reply
    becomes a sibling of the old one, which stays in the file (FR-009).
  - If the leaf is a user message, generate directly.
  - If the leaf is the greeting or the character record, do nothing and show a notice.
- **Resume**: `getBranch()` gives the current path. Rebuild the history from the greeting and
  message entries along it, and ignore unknown entry types.

## R3. Settings

- **Decision**: Extend 001's `Settings` in `packages/data/src/settings.ts` with optional
  `userName`, `loreBudget`, `scanDepth`, `replyReserve` and
  `lorebookAttachments: Record<characterId, lorebookId[]>`.
- **Validation**: `readSettings` validates each field independently. An invalid field is
  ignored and the others still apply.
- **Writing**: `writeSettings` merges, keeping fields it does not know about, so attaching a
  lorebook never drops the model setting.
- **When settings are read**: the character chat re-reads settings before every request, so a
  change applies to the next request (FR-007). The cost is one small file read per request.

## R4. Character picker and session list

- Reuse the overlay pattern of 001's `ModelPicker` (`packages/tui/src/components/model-picker.ts`):
  an `Input` filter plus a `SelectList`, filtered with `fuzzyFilter`.
- Build a small `ListPicker<T>` only if the two pickers would otherwise share more than about
  30 lines. Otherwise copy the pattern. Constitution VII allows an abstraction only once there
  are two uses, and here there are two.

## R5. Regenerate key

- **Ctrl+R**. It is not bound by pi-tui's defaults (`packages/tui/src/keybindings.ts`) and
  matches the "reroll" idea. It is handled in the app's input listener, as Esc is in 001.

## R6. Context window per model

- `ModelInfo.contextWindow` is added in 003 (T005). The character chat passes the current
  model's value to `assemblePrompt`.
