# Data Model: Chat Editing

## Session file

There is no new entry type and no format change. Undo and edit use pi's existing branches
(research R1–R3):

| Operation | What is appended | The new last entry |
|---|---|---|
| `/undo` | a copy of the entry just before the undone user message: a message (`appendMessage`) or a custom entry (`appendCustomEntry`), after `branch()` to its parent, or `resetLeaf()` if it is the root | the copy |
| Save an edited player message | a new user message after `branch()` to the edited message's parent, then the reply as with any send | the reply, or the user message if the request failed |
| Save an edited character message | `{ ...original, content: [{ type: "text", text }], stopReason: "stop" }` after `branch()` to the edited message's parent | the edited reply |

Invariant: **the last entry in the file is the last item the chat shows.** `history()`,
`regenerateTarget()`, `regenerate()` and `prev()` rely on it (research R1).

Nothing is deleted. Taken-back and dropped messages remain as earlier branches.

## `ChatHistoryItem` (engine)

Gains `entryId?: string`: the session entry id of a message. The greeting has no `entryId`.

```ts
interface ChatHistoryItem {
  role: "user" | "character";
  text: string;
  interrupted?: boolean;
  entryId?: string;
}
```

## `CharacterChat` (engine)

| Member | Result |
|---|---|
| `undo(): { text: string } \| "nothing-to-undo"` | R2; clears `replaced` |
| `resendFrom(entryId, text): Promise<TurnResult \| null>` | R3; throws if `entryId` is not a user message on the current branch; returns `null` while streaming, as `send` does |
| `editReply(entryId, text): void` | R3; throws if `entryId` is not an assistant message on the current branch; clears `replaced` |

## App state (in memory)

| Name | Meaning |
|---|---|
| `editing: { entryId, role: "user" \| "character", text } \| null` | the message being edited; `text` is the original. Set by the `/edit` picker. Cleared by a save, Esc, or a chat switch (not reachable while editing) |

## State transitions

```text
editing:  null ──/edit, choose──▶ { entryId, role, text }
          editing ──Esc──▶ null (chat unchanged, input cleared)
          editing ──Enter, empty──▶ editing (message)
          editing(user) ──Enter──▶ spend check ──Stop──▶ editing (text back in input)
                                              └─go───▶ null, resendFrom → stream
          editing(character) ──Enter, unchanged──▶ null ("No changes.")
          editing(character) ──Enter, changed──▶ null, editReply

replaced (/prev): any ──undo, resendFrom, editReply──▶ none
```
