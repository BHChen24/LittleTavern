# Data Model: Usability Pass

This feature adds no persisted data. The in-memory shapes it adds or changes are:

| Name | Shape | Where |
|---|---|---|
| `AppPaths` (extended) | adds `importRoot`, `importCharactersDir` and `importLorebooksDir` (research R2) | `data/src/paths.ts` |
| `Command` | pi-tui `SlashCommand`: `{ name, description, argumentHint?, getArgumentCompletions? }` | `tui/src/commands.ts` |
| `FileBrowser` state | `{ directory: string; filter: string }` | `tui/src/components/file-browser.ts` |
| Key save choice | `"session"` (default) or `"save"` | `tui/src/components/key-prompt.ts` |

Settings, credentials, the ledger, sessions and the library keep the formats defined in features
001–005.
