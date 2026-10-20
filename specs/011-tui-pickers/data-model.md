# Data Model: Pickers Instead of Ids

No stored data changes. Settings, the library and session files keep their current shapes.

## Lorebook picker entry (in memory only)

Built each time `/lorebooks` opens, in this order:

| Entry | Shown as | Choosing it |
|---|---|---|
| Import | `Import a lorebook…` | Opens the file browser in the import folders' `lorebooks/`; a successful lorebook import is attached |
| Card lorebook (if the card embeds one) | `<name>` · `part of the card` | Nothing changes; the app says it is part of the card |
| Library lorebook | `<name>` · `attached` or `not attached` | Toggles it: attach or detach |
| Missing attachment | `<id>` · `attached, missing from the library` | Detaches it |

The state is computed from:

- the character card's embedded lorebook;
- `listLibrary(paths)` filtered to lorebooks;
- `CharacterChat.attachedLorebookIds()`, the raw ids in
  `settings.lorebookAttachments[<character id>]`.

## Show picker entry (in memory only)

One entry per library item: the name as the label, `<kind> · <id>` as secondary text, and
`<name> <id>` as the search text. Choosing it prints `formatItemDetails(item)`.

## State transitions

```text
library lorebook: not attached ──(choose)──▶ attached ──(choose)──▶ not attached
missing attachment: attached ──(choose)──▶ removed
card lorebook: no transitions

character chat ──/new──▶ new character chat (new session; the old one stays in /sessions)
innkeeper mode ──/new──▶ innkeeper mode with an empty conversation
no chat ──/new──▶ no chat (message)
```
