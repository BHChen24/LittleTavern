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
5. Complete setup with `/model`, `/apikey` and a character or `/innkeeper`, then check the placeholders: "Talk to <name>… (/ for commands)" in a chat, "Talk… (/ for commands)" in plain chat, and the /apikey hint without a key.
6. Without a key, the status shows no model. Add a key with /apikey and check that the model picker opens.
7. Press Ctrl+O, write a long message in your editor, then save and close: the text is back in the input.
8. Set `"mouse": false` in settings.json and relaunch: the terminal's own selection works.
9. Shrink the window below 40 columns and 10 rows, on the home screen and in a chat: no crash, the plain title replaces the logo, and the input is still usable. Enlarge it again: the layout recovers.
10. Run `NO_COLOR=1 littletavern`: no colours, but names are still bold, `*actions*` italic, bars and `Error:` visible.
11. The home screen shows the block-letter logo on the left and the name only once. Press Enter: chat opens with no picker, with missing setup steps listed explicitly. Use `/characters`, choose "New character" and create one; `/new-character` no longer exists. Cancelling a picker does not select a chat mode. `/innkeeper` explicitly enables that mode once model/key setup is complete; `/plain` no longer exists.
12. Start without a saved model or key. Try sending text and Ctrl+R: the draft remains, the app lists the missing steps, and no reply or usage appears. Add a key, cancel the chained model picker, and try again: chat stays disabled until a model is selected and a character or `/innkeeper` is chosen. Setup and library commands remain available.
13. Restart with a valid saved model and a saved or environment key: these count as configured, but sending stays disabled until a character is selected/resumed or `/innkeeper` is used in this run. Check the next-step placeholders and the `No model — /model` status when appropriate.
