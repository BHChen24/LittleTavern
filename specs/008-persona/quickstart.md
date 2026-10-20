# Quickstart: validating 008-persona

## Automated

```bash
pnpm build && pnpm lint && pnpm test
```

## Manual (owner)

1. In `littletavern`, run `/persona` and choose "New persona". Write Name "Traveller" and a short description, then save and close the editor.
2. The notice says "You are now Traveller", and `~/.littletavern/personas/traveller.md` exists.
3. Run `/chat <阿芙拉 id>`. A greeting that uses `{{user}}` now says Traveller.
4. Send a message, then run `/trace`: a `persona` part is listed between the lore and the description.
5. Create a second persona and switch to it with `/persona`. The next `/trace` shows the new one.
6. Choose "No persona": `/trace` no longer has a `persona` part.
7. Quit and relaunch: the persona you chose last is still active.
