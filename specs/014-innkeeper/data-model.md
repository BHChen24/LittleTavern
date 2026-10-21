# Data Model: The Innkeeper

## Settings (`settings.json`)

New field:

| Field | Type and range | Default | Meaning |
|---|---|---|---|
| `limits.toolRounds` | whole number ≥ 1 | 5 | tool rounds allowed per innkeeper message |

Settings the change tool accepts (spec FR-005), as `setting` keys:

| Key | Rule (`checkSettingChange`) | Removable (`null`) | Applies |
|---|---|---|---|
| `limits.replyTokens` | whole number ≥ 0 | no | next request |
| `limits.runSpendUsd` | number ≥ 0 | no | next send (the allowance becomes the new value) |
| `limits.toolRounds` | whole number ≥ 1 | no | next innkeeper message |
| `generation.temperature` | number 0–2 | yes | next request |
| `generation.topP` | number 0–1 | yes | next request |
| `generation.topK` | whole number ≥ 1 | yes | next request |
| `generation.minP` | number 0–1 | yes | next request |
| `generation.repetitionPenalty` | number > 0 | yes | next request |
| `loreBudget` | number > 0 | yes | next request |
| `scanDepth` | whole number ≥ 0 | yes | next request |
| `replyReserve` | number ≥ 0 | yes | next request |
| `mouse` | true or false | no | after a restart |

## Backups

`<configDir>/backups/settings-<YYYYMMDD-HHMMSS-mmm>[-<k>].json`: a byte-for-byte copy of
`settings.json` taken before each confirmed change. None is taken if the file does not exist.
Backups are never overwritten or deleted by the app.

## Engine types

```ts
interface TurnResult {
  // existing fields; usage is now the sum over every assistant message of the run
  toolLimitReached?: boolean;
}

interface InnkeeperHistoryItem {
  kind: "user" | "innkeeper" | "tool";
  text: string; // for "tool": the tool's label
}

interface ConfirmRequest {
  lines: string[]; // shown as a muted notice before the picker (may be empty)
  title: string;   // the picker title
}

interface InnkeeperToolContext {
  paths: AppPaths;
  help(): string;                       // help text, import folders, settings file, backups folder
  requestSettings(): RequestSettings;   // the values in use (data's type, now with toolRounds)
  confirm(request: ConfirmRequest, signal?: AbortSignal): Promise<boolean>;
  openChat(item: CharacterItem, sessionPath?: string): void;
  applied(
    changes: { setting: string; value: number | boolean | null }[],
    backupPath: string | null,
  ): void;
}
```

All of these are LittleTavern types, exported from the engine barrel. `ChatSessionOptions` gains
`innkeeper?: InnkeeperToolContext` and `toolRounds?: number`; `ChatSession` builds the tools
from the context. `ChatSession` gains `setRequest(request)`, a `toolRounds` setter,
`onToolCall(listener)` and `innkeeperHistory()`. `createInnkeeperTools` and every pi type
(`AgentTool`, typebox schemas) stay inside `innkeeper-tools.ts` and `chat-session.ts`, which are
not exported as pi types (constitution II).

## App state (in memory)

| Name | Meaning |
|---|---|
| `requestSettings` | now holds `toolRounds` too, is updated by confirmed changes (only the changed keys), and is what `context.requestSettings()` returns |
| `allowedSpend` | set to the new `runSpendUsd` when it changes |
| `pendingOpen: { item, sessionPath? } \| null` | a chat to open when the innkeeper's run ends |
| `confirming: boolean` | a confirmation picker is open; Esc answers No instead of aborting |

## State transitions

```text
innkeeper send ──▶ run (rounds 0)
  each assistant turn with tool results ──▶ rounds + 1
  rounds = toolRounds ──▶ end, toolLimitReached
  a tool result with details.endTurn ──▶ end
  run ends ──▶ pendingOpen? open it : stay

change_settings ──validate──fail──▶ error result (nothing asked)
                 └─ok──▶ confirm ──No/Esc/abort──▶ "The guest declined."
                                 └─Yes──▶ updateSettings (backup, write) ──▶ applied(changes, backupPath) ──▶ saved result
```
