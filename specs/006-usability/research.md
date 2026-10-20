# Research: Usability Pass

Verified on 2026-10-20 against `../pi` at `v1.3.0` and the code on `005-lore-inspector`.

## R1. Command suggestions come from pi-tui

- **Decision**: Build one `COMMANDS` table in `packages/tui/src/commands.ts`. Each entry is
  `{ name, description, argumentHint?, getArgumentCompletions? }`, which is pi-tui's
  `SlashCommand` shape (`packages/tui/src/autocomplete.ts:257`). Pass the table to
  `new CombinedAutocompleteProvider(COMMANDS, importRoot)` and call
  `editor.setAutocompleteProvider(provider)`. pi-tui's own `test/chat-simple.ts` does the same.
- **`/help`** is generated from the same table (FR-003), so `APP_HELP` stops being a hand-written
  string. Key bindings (Ctrl+C, Ctrl+R, Esc, Enter) are appended as a short fixed block.
- **Argument suggestions** come from `getArgumentCompletions(prefix)`, which returns
  `AutocompleteItem[]` (`{ value, label, description }`). `value` is what gets inserted:

  | Command | Suggests | `label` / `description` | `value` |
  |---|---|---|---|
  | `/chat` | characters from `listLibrary` | name / id | id |
  | `/show` | all library items | name / kind and format | id |
  | `/attach` | lorebook items | name / id | id |
  | `/detach` | the current chat's attached lorebooks (`activeLorebooks()` where `attached`) | name / id | id |
  | `/import` | entries of the directory in the typed prefix, resolved against the import root unless absolute or `~/`; sub-folders with a trailing `/`, files only `.json` and `.png` | — | the path |

  Filter by a case-insensitive "contains" match on the label or value.
- **The library is read when suggestions are requested.** `listLibrary` reads small JSON files,
  and this keeps suggestions fresh after an import.

## R2. Import root and file browser

- **Import root**:
  - `~/.littletavern` (`os.homedir()`), with `characters/` and `lorebooks/`;
  - when `LITTLETAVERN_HOME` is set, `<LITTLETAVERN_HOME>/import`, with the same sub-folders.

  Add `importRoot`, `importCharactersDir` and `importLorebooksDir` to `AppPaths` in
  `packages/data/src/paths.ts`. `ensureImportFolders(paths)` creates them with
  `mkdirSync(..., { recursive: true })`, catches errors, and returns a notice string or `null`.
- **Browser**: `FileBrowser` in `packages/tui/src/components/file-browser.ts`. It reuses
  `ListPicker` for the filter and the list. It holds the current directory, rebuilds the picker on
  navigation, and lists, in order:
  1. a `..` "go up" entry, hidden at the filesystem root;
  2. the sub-folders, sorted, with a trailing `/`;
  3. the `.json` and `.png` files, sorted.

  Selecting a folder enters it, and selecting a file calls `onSelect(path)`. An empty folder
  shows "No .json or .png files in <full path>". Unreadable folders show the error and stay put.
  Symlinked folders are followed through `statSync`.
- **Selection** calls the same `importFile(paths, file)` and `formatImportReport` as
  `/import <path>` (FR-006).

## R3. Home screen

- **Decision**: a `HomeScreen` component in `packages/tui/src/components/home-screen.ts`, holding
  the name and version, the one-line description "Terminal roleplay with character cards and
  lorebooks", "Press Enter to start", "Type / for commands", the key status, and the
  import-folder hint when the library is empty.
- **Wiring**:
  - `app.ts` starts with only the home screen as a child.
  - Enter swaps it for the chat layout (header, transcript, editor, status bar) and focuses the
    editor.
  - Ctrl+C quits through the existing input listener.
  - Tests reach the chat view by calling `app.enterChat()`.

## R4. API key only through `/apikey`

The key-prompt pieces from 001 are reused: `MaskedKeyInput` and the `KeyPrompt` component, with
its save choice reordered.

| Event | New behaviour |
|---|---|
| Startup with no key | Remove `promptForKey()` from startup. `needsKey` no longer opens anything |
| Send or regenerate with no key | `notice("No API key yet. Type /apikey to add your OpenRouter key.")`. The editor text is restored with `editor.setText(value)` |
| `key-rejected` error | The notice says "OpenRouter rejected the key. Type /apikey to replace it." No prompt opens |
| `/apikey` | A `ListPicker` of providers, containing only `OpenRouter`. If a key is active, the description shows its source. Choosing it opens a second picker with "Enter a new key", plus "Forget saved key" when a saved key exists. With no key active, the masked input opens directly |
| After a key is entered | The choice list is "Use for this session only" (first, so selected by default) and then "Save to <path> (readable only by you)". Nothing is written unless Save is chosen |
| `/key`, `/forget-key` | `notice("/key was replaced by /apikey.")` and the same for `/forget-key`. Both are left out of `COMMANDS` |

- **Environment key**: when the active key came from the environment and is replaced, the notice
  adds "OPENROUTER_API_KEY in the environment will be used again next launch."

## R5. Polish (P3)

- **Layout**: confirm that the chat layout's last child is the status bar. The screenshot on
  2026-10-19 showed it under the header while the key-prompt overlay was open; check this with a
  render test.
- **Message styles**: through `theme.ts`:
  - user messages get a `You:` label in a dim style;
  - character messages get a `<name>:` label in bold;
  - notices get a `·` prefix in italic.

  Labels carry the meaning, colour is extra (FR-015).
- **Doubled separators**: pi-tui's `Editor` draws its own borders. The doubled line came from the
  editor border sitting next to the status-bar separator, so drop any extra separator.

## R6. Language rule enforcement (constitution 3.1.0)

- **Decision**: add a test, `packages/tui/src/language.test.ts`. It walks
  `packages/*/src/**/*.ts`, excluding `*.test.ts` and `fixtures.ts`, and fails on any character
  matching `/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u`, listing
  the file and line. Typographic punctuation (`·`, `…`, `—`, `•`, `↑↓`) is allowed.
