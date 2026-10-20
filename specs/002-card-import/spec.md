# Feature Specification: Card and Lorebook Import

**Feature Branch**: `002-card-import`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "002-card-import: Import character cards and lorebooks into
LittleTavern's own data directory. Accepted card formats: V3 JSON (spec chara_card_v3), V2 JSON
(spec chara_card_v2), PNG with tEXt chunk ccv3 (base64 V3 JSON) and/or chara (base64 V2 JSON),
ccv3 preferred when both. Lorebooks: embedded data.character_book (entries array) and standalone
SillyTavern world-info JSON (entries object keyed by uid). Not accepted in v1, with a clear error:
V1 cards, CharX, BYAF, YAML, PNG without card chunks. Lossless: original source preserved
verbatim; unknown/extension fields kept, not executed. Imported items copied into the app's own
directory for easy management. Users import from the TUI (and a non-interactive CLI path for
testing), see a list of imported characters/lorebooks with correct types, and inspect what was
imported. Committed tests use synthetic fixtures; real samples in ../test-cards/ are used by tests
that run only when that directory exists. Consumers: 003 prompt assembly and 004 character chat
need a normalized internal representation of card fields and lorebook entries."

## Context

Character cards and lorebooks are the ecosystem formats shared across roleplay frontends
(constitution IV). This feature brings them into LittleTavern without losing anything. Later
features consume what it produces: 003 (prompt assembly) reads card fields and lorebook entries;
004 (character chat) starts conversations with an imported character. This feature does not
change how chat works.

## Clarifications

### Session 2026-10-19

- Q: Is "lossless write-back" in v1 satisfied by returning the stored original, or must
  LittleTavern regenerate a valid card from its parsed data? → A: Neither. v1 provides import
  only, with no export of any kind. The original stays in the library folder, where the owner can
  copy it with ordinary file tools.
- Q: What happens when the same file content is imported again? → A: Byte-identical content is
  skipped with an "already imported" message that names the existing item. Different content is
  imported as a new item, even when the name is the same.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import a character card (Priority: P1)

The owner has a character card file: a JSON file or a PNG image with the card embedded. They
import it from inside the app (or from the command line). LittleTavern copies it into its own
library and reports what it found: the character's name, the detected format, how many lorebook
entries came embedded in the card, and which extra data was kept but will not be used.

**Why this priority**: Without imported characters there is nothing to roleplay with; every later
v1 feature depends on this.

**Independent Test**: Import one V3 JSON card, one V2 JSON card and one PNG card. Each import
reports the right name and format, and each card appears in the library.

**Acceptance Scenarios**:

1. **Given** a V3 JSON card, **When** the user imports it, **Then** the app reports the
   character's name, "Character card V3 (JSON)", the number of embedded lorebook entries, and the
   names of preserved extension fields (for example `regex_scripts`).
2. **Given** a V2 JSON card, **When** imported, **Then** it is reported as "Character card V2
   (JSON)" and imported the same way.
3. **Given** a PNG carrying both a V3 and a V2 card, **When** imported, **Then** the V3 data is
   used and the report says "Character card V3 (PNG)".
4. **Given** a PNG carrying only a V2 card, **When** imported, **Then** it is reported as
   "Character card V2 (PNG)".
5. **Given** a card whose text is in Chinese, Japanese or another non-Latin script, **When**
   imported, **Then** the name and fields display exactly as written.
6. **Given** a successful import, **When** the user looks in LittleTavern's library directory,
   **Then** the original file is there byte for byte, next to LittleTavern's own readable copy of
   the parsed data.

---

### User Story 2 - Reject what is not supported, clearly (Priority: P1)

The owner tries files that are not supported in this version. Each attempt fails with a message
that names the file, says what kind of file it appears to be, and says that this kind is not
supported yet, or what exactly is wrong with it. Nothing partial is left in the library.

**Why this priority**: Real-world files vary widely. A silent or confusing failure costs more
time than a missing feature.

**Independent Test**: Import each unsupported or broken sample. Each produces the specific message
below and the library is unchanged.

**Acceptance Scenarios**:

1. **Given** a V1 card (character fields at the top level, no format marker), **When** imported,
   **Then** the message says V1 cards are not supported in this version.
2. **Given** a CharX archive, a BYAF file or a YAML card, **When** imported, **Then** the message
   names that format and says it is not supported in this version.
3. **Given** an ordinary PNG with no card inside (for example a screenshot), **When** imported,
   **Then** the message says the image contains no character card.
4. **Given** a file that is not valid JSON, or a PNG whose embedded card data cannot be decoded,
   **When** imported, **Then** the message says the file is damaged and, for JSON, where parsing
   failed.
5. **Given** a card without a name, **When** imported, **Then** it is rejected because a
   character must have a name.
6. **Given** a path that does not exist or cannot be read, **When** imported, **Then** the
   message says so.
7. **Given** any failed import, **When** it ends, **Then** nothing new appears in the library.

---

### User Story 3 - Import a standalone lorebook (Priority: P1)

The owner has a lorebook (world info) file exported from SillyTavern. They import it, and
LittleTavern reports its name and number of entries and adds it to the library as a lorebook.

**Why this priority**: Lorebooks are the core of the "right lore at the right time" goal that
003 builds on.

**Independent Test**: Import a SillyTavern world-info file. The reported entry count matches the
file, and the lorebook appears in the library as a lorebook, not as a character.

**Acceptance Scenarios**:

1. **Given** a SillyTavern world-info file, **When** imported, **Then** the app reports
   "Lorebook (SillyTavern world info)", its name, and its entry count.
2. **Given** a world-info file with no name inside, **When** imported, **Then** the file name
   (without extension) is used as the lorebook's name.
3. **Given** a lorebook entry that is disabled in the source, **When** imported, **Then** it is
   kept and marked disabled, not dropped.
4. **Given** a file that is a lorebook in the character-card lorebook shape (entries as a list),
   **When** imported, **Then** it is accepted as "Lorebook (card format)".

---

### User Story 4 - Browse and inspect the library (Priority: P2)

The owner lists what has been imported, sees characters and lorebooks separately with their types,
and opens one to check what LittleTavern understood: the main card fields, the lorebook entries
with their trigger keys, and the data that was preserved but is not used.

**Why this priority**: Being able to inspect the result is how the owner checks that "the types
are correct". It also shows data fidelity during a demo.

**Independent Test**: After importing two cards and one lorebook, the list shows two characters
and one lorebook with their format labels. Inspecting a card shows its name, description,
greeting and lorebook entries.

**Acceptance Scenarios**:

1. **Given** imported items, **When** the user lists the library, **Then** characters and
   lorebooks are shown in separate groups, each item with its name, format label, embedded or
   total entry count, and import date.
2. **Given** a character, **When** the user inspects it, **Then** they see the description,
   personality, scenario, first message, number of alternate greetings, example messages, system
   prompt and post-history instructions if present, tags, creator and creator notes.
3. **Given** a character or lorebook with lorebook entries, **When** inspected, **Then** each entry
   shows its trigger keys, whether it is always-on (constant) or enabled, its order, and the start
   of its content.
4. **Given** preserved but unused data (extension fields such as `regex_scripts` or
   `tavern_helper`, or any unrecognised field), **When** inspected, **Then** the view lists those
   field names under "Preserved, not used".
5. **Given** the library is empty, **When** listed, **Then** the user sees a hint explaining how
   to import.

---

### Edge Cases

- The same file imported twice: the second import changes nothing and reports "already imported"
  with the existing item's name (FR-012). The same card edited and saved is new content, so it is
  imported as a new item.
- Two different characters with the same name: both are kept and can be told apart by import
  date and identifier.
- A very large card or lorebook (hundreds of entries, several megabytes of text) imports without
  truncating any field.
- A JSON file starting with a byte-order mark is accepted.
- A file with a misleading extension (a PNG card saved as `.json`, or the reverse) is recognised
  by its content, not its extension.
- A V3 card whose `spec_version` is a newer 3.x is accepted as V3. A `spec` value that is neither
  V2 nor V3 is rejected as unsupported.
- Embedded lorebook present but empty, or explicitly `null`: the card imports with zero entries.
- Text containing `{{char}}`, `{{user}}` or other macros is stored unchanged; substitution is
  003's job.
- Fields with the wrong type (for example `tags` as a string): the original is kept verbatim, the
  parsed copy uses a safe empty value for that field, and the import report lists a warning.

## Requirements *(mandatory)*

### Functional Requirements

**Accepted inputs**

- **FR-001**: The system MUST import character cards in these forms: V3 JSON (`spec` is
  `chara_card_v3`), V2 JSON (`spec` is `chara_card_v2`), and PNG images carrying a card in a
  `ccv3` (V3) and/or `chara` (V2) text chunk. When both chunks exist, V3 MUST be used.
- **FR-002**: The system MUST import lorebooks embedded in a card (`character_book`) and
  standalone lorebook files in either the SillyTavern world-info shape (entries keyed by
  identifier) or the card lorebook shape (entries as a list).
- **FR-003**: The file type MUST be determined by content, not by file extension.
- **FR-004**: The system MUST reject, with a message naming the detected kind: V1 cards, CharX
  archives, BYAF files, YAML cards, PNG images without a card, and any other unrecognised file.
- **FR-005**: Damaged input (invalid JSON, undecodable embedded data) and cards without a name
  MUST be rejected with a message that says what is wrong.
- **FR-006**: A failed import MUST leave the library unchanged.

**Fidelity**

- **FR-007**: The original file MUST be stored in the library byte for byte.
- **FR-008**: Every field of the source card or lorebook, including extension data and fields the
  system does not recognise, MUST be preserved in the parsed copy. Nothing is dropped.
- **FR-009**: Preserved extension data (for example regex scripts or helper scripts) MUST never be
  executed or applied by this feature.
- **FR-010**: Text MUST be stored exactly as written, including macros, whitespace and non-Latin
  scripts.

**Library**

- **FR-011**: Imported items MUST be stored in LittleTavern's own data directory, one folder per
  item, holding the original file and a readable parsed copy, so the owner can browse, back up or
  delete them with ordinary file tools.
- **FR-012**: Importing a file whose bytes are identical to an item already in the library MUST
  NOT create a duplicate or change anything; the user is told it is already imported, with the
  existing item's name. A file with different bytes is imported as a separate item, even when the
  character name is the same.
- **FR-013**: Each item MUST have a stable identifier, a display name, a kind (character or
  lorebook), a format label, and its import date.

**Normalized representation (for 003 and 004)**

- **FR-014**: For each character the system MUST provide: name, description, personality,
  scenario, first message, alternate greetings, example messages, system prompt, post-history
  instructions, creator notes, tags, creator, character version, and its embedded lorebook (if
  any), regardless of whether the source was V2 or V3.
- **FR-015**: For each lorebook entry the system MUST provide: trigger keys, secondary keys,
  content, enabled, constant (always on), insertion order, and a display name or comment, mapped
  from either source shape. The remaining source fields of the entry (for example position, scan
  depth, case sensitivity or probability) MUST stay available, unchanged, for 003 to use later.

**Interfaces**

- **FR-016**: Users MUST be able to import a file from inside the app by giving its path, and see
  the import report.
- **FR-017**: Users MUST be able to list the library and inspect an item from inside the app.
- **FR-018**: The same import, list and inspect operations MUST be available from the command
  line without starting the full-screen interface, printing the same information, and exiting
  with a non-zero code when an import fails.

### Key Entities

- **Library item**: one imported thing. Attributes: identifier, kind (character or lorebook),
  display name, format label, import date, content fingerprint (for duplicate detection), location
  of the original file, location of the parsed copy, warnings recorded at import.
- **Character**: the normalized card fields listed in FR-014, plus the preserved extension and
  unrecognised data, plus an optional embedded lorebook.
- **Lorebook**: a name, an optional description, and an ordered list of entries. Standalone or
  embedded in a character.
- **Lorebook entry**: the normalized fields in FR-015 plus all remaining source fields preserved
  verbatim.
- **Import report**: the result shown to the user. On success: the item name, format label, entry
  count, preserved extension names and warnings. On failure: the file, the detected kind and the
  reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every local real-world sample listed in `../test-cards/README.md` imports
  successfully with the format label and entry count stated there.
- **SC-002**: For 100% of imported items, the stored original is byte-identical to the source
  file.
- **SC-003**: For 100% of imported items, every field name present in the source (at any depth)
  is present in the parsed copy.
- **SC-004**: Every unsupported or damaged input in the acceptance scenarios produces its specific
  message, and the library is unchanged afterwards.
- **SC-005**: Importing a typical card (under 1 MB) takes under one second.
- **SC-006**: The owner can import a card and confirm its type and contents in the app in under
  one minute.

## Acceptance Testing

Per the constitution's testing policy:

**Automated (committed, synthetic fixtures generated by code):**

- V3 JSON, V2 JSON, PNG with both chunks, and PNG with only V2: correct format label, name and
  entry count.
- Lossless checks: the original is byte-identical, and every source field name survives in the
  parsed copy, including unknown fields at the card, extension and lorebook-entry levels.
- Each rejection in User Story 2 gives its message and leaves the library unchanged.
- Lorebook mapping for both shapes, including disabled entries and the missing-name fallback.
- Duplicate import is detected.

**Automated, local only:** if `../test-cards/` exists, import every sample listed in its README
and compare against the README's stated format and counts (SC-001).

**Manual (owner):** the import, list and inspect views in the app.

**Deferred:** any test judged too complex during planning is listed in the plan instead of being
written.

## Assumptions

- There is a single user and a single library. Items are not shared or synced.
- Import is by file path. A file browser is out of scope.
- v1 provides import only. Export, editing and deleting from inside the app are out of scope. The
  original file is kept byte for byte (FR-007) in the item's library folder; the owner can copy it
  or delete the folder with ordinary file tools.
- Embedded lorebooks stay attached to their character and are not listed as separate lorebooks.
  Linking standalone lorebooks to characters is part of 004.
- Images inside PNG cards are not displayed (text-only terminal); the PNG is kept as the original
  file.
- Macro substitution, lorebook activation and prompt use are part of 003. Starting a chat with a
  character is part of 004.
- Real-world samples are third-party content and stay outside the repository (constitution IV).
