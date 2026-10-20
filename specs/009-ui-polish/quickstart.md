# Quickstart: validating 009-ui-polish

## Automated

```bash
pnpm build && pnpm lint && pnpm test
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

## Manual (owner)

1. Print some shell output, then run `littletavern`. The screen is clean and shows the logo. Quit: the earlier output is back.
2. Chat with a character until the transcript is longer than the window. The mouse wheel and PgUp/PgDn scroll it. Dragging selects text, and releasing copies it.
3. Check the messages: both names are bold in different colours, each message has a bar, quoted speech is coloured, and `*actions*` are italic.
4. Send a message: "<name> is writing…" shows until the reply starts.
5. Check the placeholders: "Talk to <name>… (/ for commands)" in a chat, "Talk… (/ for commands)" in plain chat, and the /apikey hint without a key.
6. Without a key, the status shows no model. Add a key with /apikey and check that the model picker opens.
7. Press Ctrl+O, write a long message in your editor, then save and close: the text is back in the input.
8. Set `"mouse": false` in settings.json and relaunch: the terminal's own selection works.
9. Shrink the window below 40 columns and 10 rows, on the home screen and in a chat: no crash, the plain title replaces the logo, and the input is still usable. Enlarge it again: the layout recovers.
10. Run `NO_COLOR=1 littletavern`: no colours, but names are still bold, `*actions*` italic, bars and `Error:` visible.
11. The home screen shows the block-letter logo on the left and the name only once. Press Enter: the character picker opens. Choose "New character" and create one; `/new-character` no longer exists. Press Esc on the picker, then `/innkeeper`: the placeholder and replies are labelled Innkeeper, and `/plain` no longer exists.
