# Contract: The Innkeeper

`<settings>` is `paths.settingsFile`, `<name>` a character name through `stripControls`, `<n>` a
number.

## System prompt (`INNKEEPER_SYSTEM_PROMPT`)

```text
You are the innkeeper of LittleTavern, a terminal app for roleplay with character cards. You
welcome guests and help them use the app. Speak warmly and briefly, like a tavern keeper, and
answer in the guest's language.

Every fact about the app or the guest's setup must come from your tools. Call them instead of
guessing, and say so when they do not have the answer.

You can change only the settings that your change_settings tool accepts. The guest sees every
proposed change and approves or declines it; tell them the result. You can open a chat with a
character, new or continued, with open_chat; the guest approves it too.

You cannot change the model, the persona, lorebooks or the name characters use. Name the command
instead: /model, /persona, /lorebooks. The default name is asked on the first start; a persona's
name replaces it. You cannot see or change the API key; point to /apikey.
```

## Tool lines (muted, one per tool call)

Shown as `· Innkeeper <label>`. The labels:

| Tool | Label |
|---|---|
| `read_settings` | `checked the settings` |
| `list_characters` | `looked at the guest book` |
| `list_personas` | `looked at the personas` |
| `get_help` | `read the house rules` |
| `change_settings` | `proposed a settings change` |
| `open_chat` | `offered to open a chat` |

## Confirmations (`ListPicker`, entries `Yes` and `No`; Esc = No)

| Tool | Before the picker (muted notice) | Picker title |
|---|---|---|
| `change_settings` | one line per change: `<setting>: <old> → <new>`, where an unset value reads `default` and a removal reads `default` on the right | `Apply these settings changes?` |
| `open_chat`, new | — | `Start a new chat with <name>?` |
| `open_chat`, resume | — | `Continue your latest chat with <name> (last <modified, locale string>)?` |

## After a confirmation

| Situation | Text |
|---|---|
| Settings saved, with a backup | `Settings saved. The previous settings were backed up to <backupPath>.` |
| Settings saved, no earlier file | `Settings saved.` |
| `mouse` among the changes | `The mouse setting applies after a restart.` |
| Declined | no notice; the tool result tells the innkeeper `The guest declined.` |

## Tool results the innkeeper reads (English, exact)

| Situation | Result text |
|---|---|
| Declined | `The guest declined.` |
| Invalid value | `<setting> must be <rule>. Nothing was changed.`, where `<rule>` is the rule from `checkSettingChange` |
| Removal of a non-removable setting | `<setting> cannot be removed. Nothing was changed.` |
| Malformed settings file | `settings.json is not valid JSON. Fix or remove it first. Nothing was changed.` |
| Saved | `Saved: <setting> = <value>, …` plus ` Backup: <backupPath>` when there is one |
| Unknown character | `No character matches "<character>". Characters: <names, comma-separated>.` |
| Ambiguous character | `Several characters match "<character>": <name (id)>, …. Use the id.` |
| No saved chat | `There is no saved chat with <name>.` |
| Chat opened | `The chat with <name> opens when you finish speaking.` |

## Notices

| Situation | Text |
|---|---|
| Round limit reached | `The innkeeper stopped after <n> rounds of tool calls. Ask again, or raise limits.toolRounds in <settings>.` |
| Invalid `limits.toolRounds` at start | `Ignored limits.toolRounds in settings.json: whole number ≥ 1.` (012 format) |
| `/innkeeper` | `You are talking to the innkeeper. Ask how anything works, or ask to change the hard settings. Use /characters to start a character chat.` |

## Help and README

- `COMMANDS()`: `/innkeeper` → `Ask the innkeeper for help or to change settings`.
- `get_help` (the app's `help()`) returns `helpText()`, then these lines, with absolute paths
  from `AppPaths`:

  ```text
  Character import folder: <importCharactersDir>
  Lorebook import folder: <importLorebooksDir>
  Persona import folder: <importPersonasDir>
  Settings file: <settingsFile>
  Settings backups: <configDir>/backups/
  ```
- README: what the innkeeper can look up and change, the confirmation, the backups folder
  (`<configDir>/backups/`), and `limits.toolRounds`.
