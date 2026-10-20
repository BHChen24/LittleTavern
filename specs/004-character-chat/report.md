# Implementation report: 004-character-chat

## Summary

Character chat now connects 001 to 003. The owner can:

- pick an imported character (`/characters` or `/chat <id>`) and see its greeting;
- chat with requests built by 003's `assemblePrompt`, via the new `ChatSession.generate()`;
- regenerate the last reply (`/regenerate` or Ctrl+R);
- resume saved chats (`/sessions`);
- attach standalone lorebooks per character (`/attach`, `/detach`, `/lorebooks`).

Each chat is stored with pi's `SessionManager` as an append-only JSONL tree under
`<dataDir>/sessions`. A regenerated reply becomes a sibling of the reply it replaces, so the old
one stays on disk. Usage records in a character chat carry the chat's session id. Plain chat
(001) is unchanged.

This run was implemented by Claude Code rather than Codex, because Codex's usage limit was
close. It started from 003's committed assembly API (`ee97a45`) while 003 was still being
finished.

## Tasks completed and not completed

- T001–T020 are complete, including Phase 8 (T018–T020), which was added by convergence.
- **Not done**: nothing in scope.

## Test results

```text
pnpm build && pnpm lint && pnpm test
Checked 79 files … No fixes applied.
Test Files  28 passed (28)
     Tests  165 passed (165)
node packages/tui/dist/cli.js --version → LittleTavern 0.1.0
```

| Area | What the tests cover |
|---|---|
| Settings (T-a) | per-field validation, merge on write |
| `generate()` (T-b) | the exact context the simulated model receives (system, greeting as assistant, user, trailing system); the plain transcript is restored afterwards |
| `CharacterChat` (T-c to T-g) | greeting with macros; empty greeting; assembled request with the triggered lore and `lastTrace`; regenerate replaces the reply in later requests while both stay on disk; regenerate for a trailing user message after an error; the greeting cannot be regenerated; resume round-trip and `readChatHistory`; missing character on resume; attach/use/list/detach persistence; missing attached lorebook gives one notice; session files stay under the app data directory |
| App (T-h) | `/chat <prefix>` shows the greeting and the name in the status bar; send and `/regenerate` replace the reply on screen; both usage records carry the chat's session id |

## Deferred tests

- Ctrl+R is not fed through the terminal input in a test. `/regenerate` exercises the same
  `regenerate()` function, and the key binding is a one-line input-listener branch.
- The picker look and feel is checked manually, per the plan.

## Deviations from spec or plan

- **Interrupted replies** are stored with pi's native `stopReason: "aborted"`. Research R2 said
  `custom: { interrupted: true }`, but pi's `AssistantMessage` has no `custom` field.
- **Pickers**: the planned `character-picker.ts` and `session-picker.ts` are one shared
  `ListPicker<T>` (`components/list-picker.ts`), as research R4 allows. `ModelPicker` was left
  unchanged to avoid churn.
- **`TurnResult` gained optional `provider` and `api` strings**, so a reply can be stored as a pi
  message without exposing pi types in the engine API.
- **`assembleForCharacter` is already a separate exported function.** 005's T001 ("extract it")
  is therefore already done, and 005 only needs to call it. `readChatHistory` was added for 005's
  dry run (convergence T018).
- **Chats are written to disk only after the first user message.** pi's `SessionManager` persists
  once the conversation has a user or assistant message, so a chat that has only its greeting is
  not saved (accepted in research R2).
- **Branch base**: 004 currently sits on 003 commit `ee97a45`. When 003 is finished, 004 (and 005)
  must be rebased onto 003's final commit. The two branches touch different files except the
  engine barrel (`index.ts`), where a trivial conflict may occur.

## Open questions

None.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Total development tokens: **unknown**. The
owner can add the figure from `/cost`.

## Convergence

`speckit-converge` checked:

- 16 FRs;
- the 5 buildable SCs;
- 25 acceptance scenarios;
- 6 plan decisions;
- 7 constitution principles plus the testing policy.

**Findings and fixes**:

| Task | Severity | Finding | Fix |
|---|---|---|---|
| T018 | CRITICAL (Constitution II) | `historyFromEntries`, which takes pi's `SessionEntry`, was exported | Made module-private; `readChatHistory` added in its place |
| T019 | LOW | The `/sessions` list lacked the start time | Added |
| T020 | LOW | `development-usage.md` was missing | Added |

**Re-check after the fixes**: no remaining gaps in scope.

## What the owner should check manually

Run `quickstart.md` steps 1–7 with a real key:

1. Character picker, greeting and status bar name.
2. An in-character reply that uses lore.
3. Ctrl+R replaces the reply.
4. Attach Eldoria to Seraphina.
5. Restart and resume from `/sessions`.
6. Both reply versions are in the session file.
7. The ledger records carry the session id.
