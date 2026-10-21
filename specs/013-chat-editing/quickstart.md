# Quickstart: validating 013-chat-editing

## Automated (implementer)

```bash
pnpm build && pnpm lint && pnpm test
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

## Manual (owner)

Use a temporary home, a key and a cheap model:

```bash
pnpm build
H=$(mktemp -d); LITTLETAVERN_HOME=$H node packages/tui/dist/cli.js
```

1. `/characters` → Alice. Send two messages. `/undo`: the second message and its reply are gone,
   and your text is in the input. Change it and press Enter: a new reply arrives.
2. `/undo` twice: the chat goes back to the greeting. A third `/undo` says there is nothing to
   undo.
3. Send three messages. `/edit`: the list shows the newest first, with no greeting; type a word to
   filter. Choose your second message: the banner appears above the input. Change it and press
   Enter: messages after it are gone, and a new reply arrives.
4. `/edit` → choose Alice's last reply, change a few words, press Enter: nothing is sent, and the
   reply shows your text. `/edit` again, press Esc: `Edit cancelled.`, and nothing changes.
5. While editing, press Ctrl+R: the message says to finish the edit first. Type text that starts
   with `/` (for example `/un`): no command menu opens. Press Enter: it is saved as the message,
   exactly as typed. After the edit, typing `/` opens the command menu again.
6. Quit and restart, `/sessions` → that chat: it shows exactly what was on screen before quitting.
   Ctrl+R regenerates the last reply.
7. While a reply streams, type `/undo` and press Enter: the wait message appears.
8. `/innkeeper`, then `/undo` and `/edit`: each says it works in character chats.
9. In a chat, `/edit` a message, change it, and press Ctrl+C to quit without saving. Restart and
   resume the chat: it is unchanged.
