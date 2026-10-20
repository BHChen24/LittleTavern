# Data Model: Card and Lorebook Import

All of these types live in `packages/data` and are exported for 003 and 004.

## FormatLabel

The exact strings shown to the user:

- `"Character card V3 (JSON)"`, `"Character card V2 (JSON)"`
- `"Character card V3 (PNG)"`, `"Character card V2 (PNG)"`
- `"Lorebook (SillyTavern world info)"`, `"Lorebook (card format)"`

## Character

| Field | Type |
|---|---|
| `name` | string (non-empty) |
| `description`, `personality`, `scenario`, `firstMessage`, `exampleMessages`, `systemPrompt`, `postHistoryInstructions`, `creatorNotes`, `creator`, `characterVersion` | string (default `""`) |
| `alternateGreetings`, `tags` | string[] (default `[]`) |
| `lorebook` | `Lorebook \| null` (embedded `character_book`) |

## Lorebook

| Field | Type |
|---|---|
| `name` | string (source `name`, else the file name without extension) |
| `description` | string (default `""`) |
| `entries` | `LorebookEntry[]` (card format in array order; world info sorted by numeric key) |

## LorebookEntry

| Field | Type | Card-format source | World-info source |
|---|---|---|---|
| `keys` | string[] | `keys` | `key` |
| `secondaryKeys` | string[] | `secondary_keys` | `keysecondary` |
| `content` | string | `content` | `content` |
| `enabled` | boolean (default `true`) | `enabled` | `!disable` |
| `constant` | boolean (default `false`) | `constant` | `constant` |
| `insertionOrder` | number (default `0`) | `insertion_order` | `order` |
| `name` | string | `name` ?? `comment` | `comment` |
| `source` | object, the entry verbatim | — | — |

## LibraryItem: `item.json`

| Field | Type | Notes |
|---|---|---|
| `v` | `1` | format version of `item.json` |
| `id` | string | first 12 hex characters of the SHA-256 of the original bytes |
| `kind` | `"character" \| "lorebook"` | |
| `name` | string | display name |
| `format` | FormatLabel | |
| `importedAt` | ISO-8601 string | |
| `sourceFileName` | string | base name of the imported file, for display |
| `originalFile` | string | `original.png` or `original.json`, relative to the item folder |
| `sha256` | string | full hash of the original bytes |
| `warnings` | string[] | wrong-type fields and similar |
| `preservedUnused` | string[] | field names kept in `raw` but not mapped (FR-008, inspect view) |
| `character` | `Character` | present when `kind` is `"character"` |
| `lorebook` | `Lorebook` | present when `kind` is `"lorebook"` |
| `raw` | object | the complete decoded source object, untouched |

## ImportReport

```text
{ ok: true,  status: "imported" | "already-imported", item: LibraryItem }
{ ok: false, file: string, detected: string, reason: string }
```

`detected` names what the file looked like ("V1 character card", "CharX archive", "PNG image
without a character card", "damaged JSON", …). `reason` is the user-facing message.

## Lifecycle

```text
file ──read──▶ detect ──parse/normalize──▶ (reject: ImportReport ok=false, nothing written)
                                     └──▶ hash ──exists?──▶ already-imported
                                                   └──▶ write .tmp-*/ ──rename──▶ library/<kind>/<id>/
```
