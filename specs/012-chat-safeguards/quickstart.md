# Quickstart: validating 012-chat-safeguards

## Automated (implementer)

```bash
pnpm build && pnpm lint && pnpm test
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
grep -rn '"User"' packages/*/src | grep -v "\.test\."
```

The last command must print nothing.

## Manual (owner)

Use a temporary home, a key and a cheap model:

```bash
pnpm build
H=$(mktemp -d); LITTLETAVERN_HOME=$H node packages/tui/dist/cli.js
```

1. The home screen shows the limits line. Press Enter: the name prompt shows `Traveler`; type a
   name and press Enter. `/characters` → Alice: her greeting uses your name. The limits line is
   gone once the chat starts.
2. Send a message, press Ctrl+R, then `/prev`: the first reply returns. `/prev` again: the
   second returns. Quit and restart, then `/sessions` → that chat: the reply that was showing is
   still there. `/prev` now says there is nothing to bring back.
3. Quit. In `$H/config/settings.json` set `"limits": { "replyTokens": 30, "runSpendUsd": 0.0001 }`
   and `"generation": { "temperature": 1.5, "topP": 2 }`. Restart:
   - a warning names `generation.topP`;
   - a reply is cut off with the cut-off note;
   - `/trace` shows `Requested: max 30 output tokens · temperature 1.5`;
   - the next send asks `Continue` or `Stop`; `Stop` keeps your text.
4. While a reply streams, type `/prev` and press Enter: the wait message appears.
5. A real failure, if one happens: the notice is short and names the log; the log has the
   provider message and the model.

## After merge (owner)

Release 0.1.1, the first staged npm release: bump `packages/tui/package.json`, merge through a
pull request, tag `v0.1.1`, push the tag, and approve the staged version on npmjs.com
(`specs/010-release/quickstart.md`, "Later releases").
