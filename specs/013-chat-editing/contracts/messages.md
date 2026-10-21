# Contract: Chat Editing messages and commands

`<name>` is the character's name, through `stripControls`.

## Commands

| Command | Description in `COMMANDS()` and help |
|---|---|
| `/undo` | `Take back your last message and the reply to it` |
| `/edit` | `Edit a message and continue the chat from it` |

In `COMMANDS()`, they come right after `/prev`.

## `/undo`

| Situation | Text |
|---|---|
| Undone | no notice; the transcript is re-rendered and the input holds the player's text |
| Nothing to undo | `There is nothing to undo.` |
| Innkeeper or no character chat | `/undo works in character chats.` |
| While a reply streams | `Wait for the reply, or press Esc to stop it.` (existing) |

## `/edit`

| Situation | Text |
|---|---|
| Picker title | `Edit a message (Enter edits, Esc cancels)` |
| Picker filter placeholder | `Filter messages` |
| Picker entry label | `You` for the player, `<name>` for the character |
| Picker entry description | the first line of the message text, through `stripControls` |
| No messages | `There are no messages to edit.` |
| Innkeeper or no character chat | `/edit works in character chats.` |
| While a reply streams | `Wait for the reply, or press Esc to stop it.` (existing) |

## Editing state

| Situation | Text |
|---|---|
| Banner above the input, player message | `Editing your message · Enter saves and resends · Esc cancels` |
| Banner above the input, character message | `Editing <name>'s message · Enter saves · Esc cancels` |
| Empty text on Enter | `Please enter the message text, or press Esc to cancel.` (error style; editing continues) |
| Esc | `Edit cancelled.` |
| Ctrl+R while editing | `Finish the edit first: Enter saves, Esc cancels.` |
| Character message saved unchanged | `No changes.` |
| Character message saved | no notice; the transcript is re-rendered |
| Player message saved | no notice; the edited message and the new reply appear as after a send |
| Spend cap `Stop` | `Not sent. Your message is still in the input.` (existing); the banner stays |

## Help

The help overlay lists both commands through `COMMANDS()`. No new key binding is added.
