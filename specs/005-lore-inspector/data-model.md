# Data Model: Lore Inspector

This feature adds no new persisted data. It consumes:

- `AssembledPrompt` and `AssemblyTrace`, from 003 (`specs/003-prompt-assembly/data-model.md`);
- `CharacterChat.lastTrace`, from 004.

New in-memory shapes:

| Name | Shape | Where |
|---|---|---|
| `ReportMeta` | `{ characterName: string; modelId: string; loreBudget: number }` | `tui/src/trace-format.ts` |
| `AssembleForCharacterResult` | `{ prompt: AssembledPrompt; trace: AssemblyTrace; notices: string[] }` | `engine/src/character-chat.ts` (research R1) |
| `DryRunOptions` | `{ characterId: string; message?: string; session?: string; json: boolean }` | `tui/src/cli.ts` |

## Formatter invariants (tested)

- Every `trace.lore` entry appears in the report exactly once: in the fired list, or inside
  exactly one not-fired group.
- The count in each group header equals the number of entries listed in that group.
- The first line always contains the total, the lore used against the budget, and the
  kept and left-out history counts.
