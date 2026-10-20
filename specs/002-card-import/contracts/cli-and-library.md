# Contracts: Card and Lorebook Import

This adds to `specs/001-tui-chat/contracts/cli-and-files.md`.

## Command line

| Invocation | Output | Exit code |
|---|---|---|
| `littletavern import <file> [<file>…]` | One report block per file (format below) | 0 if every file was imported or already imported, else 1 |
| `littletavern list` | Characters and lorebooks in two groups, or the empty-library hint | 0 |
| `littletavern show <id>` | Item details (format below). An unambiguous id prefix is accepted | 0, or 1 if not found or ambiguous |

`--help` lists these subcommands too.

## In-app commands

| Input | Effect |
|---|---|
| `/import <path>` | Imports one file and prints the report as a transcript notice |
| `/library` | Prints the library list as a transcript notice |
| `/show <id>` | Prints item details as a transcript notice |

The CLI and the in-app commands print **the same lines** (one shared formatter).

## Report format (examples)

```text
✓ Imported "灯塔小镇 · 雨夜来信" — Character card V3 (JSON), 2 lorebook entries  [id 3fa1c09b2e44]
  Preserved, not used: extensions.regex_scripts, extensions.tavern_helper
• Already imported: "Seraphina" [id 8d2e…]
✗ screenshot.png — PNG image without a character card
✗ old.json — V1 character cards are not supported in this version
✗ broken.json — damaged JSON: Expected double-quoted property name in JSON at position 11 (line 3 column 1)
```

## List format

```text
Characters (2)
  3fa1c09b2e44  灯塔小镇 · 雨夜来信     Character card V3 (JSON)  2 entries  2026-10-19
  8d2e5a17c0b3  Seraphina              Character card V3 (PNG)   4 entries  2026-10-19
Lorebooks (1)
  51c7e2d90a18  Eldoria                Lorebook (SillyTavern world info)  4 entries  2026-10-19
```

Empty library: `Library is empty. Import a card with /import <path> or "littletavern import <file>".`

## Details format (`show`)

- **Header**: name, format, id, import date, source file name.
- **Character fields**: each non-empty field from data-model.md `Character`, with long text cut to
  the first 200 characters plus `…`. Alternate greetings are shown as a count.
- **Lorebook entries**: one line per entry: `[on|off] [const] order=<n> keys=<k1, k2> — <first 60
  characters of content>`.
- **Preserved, not used**: the field names, comma-separated.
- **Warnings**, if any.

## Library on disk

See data-model.md (`LibraryItem`) and research R5. The owner may delete an item folder by hand;
the next `list` simply no longer shows it.
