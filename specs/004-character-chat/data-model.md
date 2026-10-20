# Data Model: Character Chat

## ChatContext (`engine`, used by `ChatSession.generate`)

`{ system: string; messages: { role: "user" | "character"; text: string }[]; afterHistory: string | null }`

`ChatContext` is built from 003's `AssembledPrompt`. Its field names deliberately match, so the
conversion is direct.

## Session file (JSONL, written by pi `SessionManager`)

Location: `<dataDir>/sessions/`. Records are described in research R2:

| Record | Written | Content |
|---|---|---|
| header | by pi | session id, timestamp, cwd = `<dataDir>` |
| `custom` `littletavern.character` | when the chat is created | `{ libraryId: string, name: string }` |
| `session_info` | when the chat is created | the character name |
| `custom` `littletavern.greeting` | when the chat is created (if the greeting is non-empty) | `{ text: string }` |
| `message` (user) | when the owner sends | pi `UserMessage` |
| `message` (assistant) | when a reply completes or is interrupted | pi `AssistantMessage`. An interrupted reply has `custom.interrupted = true` |

The records form a tree through pi's `id` and `parentId`. Regenerated replies are siblings of the
replies they replace. The current conversation is `getBranch()`.

## CharacterChat (`engine`)

| Member | Meaning |
|---|---|
| `start({ item, paths, modelId, getApiKey, simulated? })` | Creates the session, writes the character, session-info and greeting records, and returns the chat |
| `resume({ sessionPath, paths, … })` | Opens the session. Fails with "character missing" if `libraryId` is not in the library |
| `history(): ChatHistoryItem[]` | The current branch as `{ role: "user" \| "character", text, interrupted? }`, with the greeting first |
| `send(text)` | Appends the user message, assembles, generates and appends the reply. Returns a `TurnResult` |
| `regenerate()` | Applies the rules in research R2. Returns a `TurnResult`, or `"nothing-to-regenerate"` |
| `abort()`, `setModel(id)`, `isStreaming` | Delegate to the `ChatSession` |
| `lastTrace: AssemblyTrace \| null` | The trace of the last assembled request (FR-006) |
| `sessionId` | The pi session id, also used for usage records (FR-013) |
| `character`, `libraryId` | The character being chatted with |

## Settings additions (`data/settings.ts`)

| Field | Type | Default (from 003) |
|---|---|---|
| `userName` | string | `"User"` |
| `loreBudget` | number > 0 | 4000 |
| `scanDepth` | integer ≥ 0 | 2 |
| `replyReserve` | number ≥ 0 | 4000 |
| `lorebookAttachments` | `{ [characterLibraryId]: lorebookLibraryId[] }` | `{}` |

## Chat list entry (`engine`)

`{ path, sessionId, characterName, created, modified, messageCount }`. It is mapped from pi's
`SessionInfo`, using `name` for the character name, and sorted newest first.
