# Research: Card and Lorebook Import

Verified on 2026-10-19 with Node 26.7 and against the local samples in `../test-cards/`. This
feature uses no pi APIs.

## R1. Read PNG text chunks ourselves (no dependency)

- **Decision**: A small reader in `packages/data/src/cards/png.ts`. It checks the 8-byte PNG
  signature, then walks the chunks (4-byte big-endian length, 4-byte type, data, 4-byte CRC). For
  each `tEXt` chunk it splits the data at the first `\0` into keyword and text (Latin-1) and
  returns `Map<keyword, text>`.
- **Out of scope for v1**: CRC verification, `zTXt` and `iTXt`. Card tools write card data as
  `tEXt` (both local PNG samples do). A corrupt chunk shows up as a base64 or JSON failure, which
  FR-005 already reports.
- **Rationale**: About 30 lines that can be explained line by line. The `png-chunk-*` packages
  have been frozen since 2022 and were put on hold in the earlier package review.
- **Test fixtures**: tests build PNGs in memory: signature, `IHDR`, `tEXt` chunks and `IEND`, with
  the CRC from `zlib.crc32` (built into Node 22.2+, confirmed available).

## R2. Detect the kind of file by content

Detection order, implemented in `packages/data/src/cards/detect.ts`, using the bytes only (never
the extension):

1. **PNG signature** `89 50 4E 47 0D 0A 1A 0A`:
   - `ccv3` chunk present → V3 PNG;
   - otherwise `chara` chunk → V2 PNG;
   - otherwise → "PNG image without a character card".
2. **ZIP signature** `PK\x03\x04`:
   - the file contains the local-header file name `card.json` → "CharX archive";
   - it contains `manifest.json` → "BYAF archive";
   - otherwise → "ZIP archive".

   All three are rejected.
3. **Otherwise**: decode as UTF-8, strip a leading BOM and `JSON.parse`. If that fails and the
   text looks like YAML (its first non-blank line is `---`, or a `key:` line such as `name:`),
   report "YAML card". If it fails otherwise, report damaged JSON. Node's error message already
   includes the line and column, for example `at position 11 (line 3 column 1)`; pass it through.
4. **JSON shape**:
   - `spec === "chara_card_v3"` → V3 JSON; `spec === "chara_card_v2"` → V2 JSON;
   - any other `spec` value → unsupported spec;
   - no `spec`, but `name` plus any of `description`, `personality`, `first_mes` at the top level
     → V1 card (rejected);
   - `entries` is an object (not an array) → SillyTavern world-info lorebook;
   - `entries` is an array → card-format lorebook;
   - otherwise → unrecognised JSON.

- **PNG payload**: base64-decode the chunk text (`Buffer.from(text, "base64")`), decode as UTF-8,
  then `JSON.parse`. Node's base64 decoding is lenient (it skips invalid characters), so
  corruption is caught at the JSON step and reported as "embedded card data could not be decoded".

## R3. Lossless strategy: keep the raw object, add a normalized view

- **Decision**: the parsed copy (`item.json`) stores two things:
  1. `raw`: the complete decoded source object, untouched (for PNG, the decoded card JSON from the
     chosen chunk);
  2. `character` or `lorebook`: the normalized view used by 003 and 004.

  The "Preserved, not used" list is computed: every key under `raw.data` (or `raw` for lorebooks)
  that the normalized mapping does not read, plus the keys of `data.extensions`.
- **Rationale**: FR-008 and SC-003 hold by construction, because nothing is ever removed from
  `raw`, and the test is a simple key-path comparison. The alternative was to copy unknown fields
  into the normalized object one by one. It is error-prone and harder to explain.
- **The original file** is also copied byte for byte (FR-007). For PNG, `raw` holds only the
  chosen chunk; the other chunk remains available in the original file.

## R4. Normalization mapping

**Character** (V2 and V3 share these field names under `data`):

| Normalized field | Source field | Default if missing or wrong type |
|---|---|---|
| `name` | `name` (must be a non-empty string, otherwise rejected) | — |
| `description`, `personality`, `scenario` | same names | `""` |
| `firstMessage` | `first_mes` | `""` |
| `alternateGreetings` | `alternate_greetings` (string[]) | `[]` |
| `exampleMessages` | `mes_example` | `""` |
| `systemPrompt` | `system_prompt` | `""` |
| `postHistoryInstructions` | `post_history_instructions` | `""` |
| `creatorNotes` | `creator_notes` | `""` |
| `tags` | `tags` (string[]) | `[]` |
| `creator`, `characterVersion` | `creator`, `character_version` | `""` |
| `lorebook` | `character_book` (null or missing means none) | `null` |

A wrong type (for example `tags` given as a string) produces the default plus a warning such as
`field "tags" is not a list of strings; ignored`. The raw value is still in `raw`.

**Lorebook entry**:

| Normalized | Card-format entry | SillyTavern world-info entry |
|---|---|---|
| `keys` | `keys` | `key` |
| `secondaryKeys` | `secondary_keys` | `keysecondary` |
| `content` | `content` | `content` |
| `enabled` | `enabled` (default `true`) | `!disable` (default `true`) |
| `constant` | `constant` (default `false`) | `constant` (default `false`) |
| `insertionOrder` | `insertion_order` (default `0`) | `order` (default `0`) |
| `name` | `name` ?? `comment` ?? `""` | `comment` ?? `""` |
| `source` | the whole entry object, verbatim | the whole entry object, verbatim |

- **Entry order**: card-format entries keep their array order; world-info entries are sorted by
  numeric key (`"0"`, `"1"`, …).
- **Other fields** (position, depth, scan depth, case sensitivity, probability and so on) are not
  interpreted here. 003 reads what it needs from `source` (FR-015).
- **Lorebook name**: the source `name`, else the file name without extension.

## R5. Library layout and identity

```text
<dataDir>/library/
├── characters/<id>/original.png|original.json   # byte-for-byte copy
│                    item.json                    # LibraryItem (see data-model.md)
└── lorebooks/<id>/original.json
                     item.json
```

- `id` = the first 12 hex characters of the file's SHA-256. The folder names are ASCII even for
  Chinese names, and the same bytes always map to the same id, so the duplicate check (FR-012) is
  "does a folder with this id already exist".
- **No index file**: `listLibrary()` reads every `item.json`. At personal scale (tens to hundreds
  of items) this is instant, and there is no index to fall out of sync.
- **Atomic import (FR-006)**: parse and validate fully in memory first, so every rejection
  happens before anything is written. Then write into `<library>/.tmp-<random>/` and `rename` it
  to the final folder. A crash leaves at most a `.tmp-*` folder, which `listLibrary()` ignores.

## R6. Interfaces: one implementation, two surfaces

- **Operations**: `importFile(paths, filePath) → ImportReport`, `listLibrary(paths) →
  LibraryItem[]` and `getItem(paths, idOrPrefix) → LibraryItem | null` live in `data`.
- **Text formatting** is shared by the CLI and the TUI, so both print the same lines:
  `formatImportReport`, `formatLibraryList` and `formatItemDetails` live in
  `packages/tui/src/library-format.ts` and return `string[]`.
- **CLI**: `littletavern import <file…>`, `littletavern list` and `littletavern show <id>`. The
  exit code is 1 if any import failed.
- **TUI**: `/import <path>`, `/library` and `/show <id>`. Results are printed as transcript notices
  (no new screens). This extends 001's command handling.

## R7. Local real-sample test

- `packages/data/src/cards/samples.local.test.ts` reads
  `process.env.LITTLETAVERN_TEST_CARDS ?? <repo root>/../test-cards`. It uses
  `describe.skipIf(!existsSync(dir))`.
- The expected labels and counts are hard-coded in the test from `../test-cards/README.md`:

| File | Label | Name | Entries |
|---|---|---|---|
| `dsh-tavern/lighthouse-card.json` | Character card V3 (JSON) | 灯塔小镇 · 雨夜来信 | 2 |
| `dsh-tavern/airline-mvu-card.json` | Character card V3 (JSON) | 云际航空·MVU测试版 | 2 |
| `dsh-tavern/ordinary-tavern.json` | Character card V3 (JSON) | 普通酒馆 · 铜铃客栈 | 1 |
| `dsh-tavern/avra-complete.json` | Character card V3 (JSON) | 阿芙拉 | 6 |
| `dsh-tavern/avra-before.json` | Character card V3 (JSON) | 阿芙拉 | 0 |
| `dsh-tavern/avra-after-dialogue.json` | Character card V2 (JSON) | 阿芙拉 | 0 |
| `dsh-tavern/lighthouse-worldbook.json` | Lorebook (SillyTavern world info) | 灯塔镇 · 地点与风俗 | 3 |
| `sillytavern/default_Seraphina.png` | Character card V3 (PNG) | Seraphina | 4 |
| `sillytavern/Eldoria.json` | Lorebook (SillyTavern world info) | Eldoria (file-name fallback) | 4 |

- The sample files are read from their location and never copied into the repo. The library goes
  to a temporary `LITTLETAVERN_HOME`.
