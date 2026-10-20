# Data Model: Chat Safeguards

## Settings (`settings.json`)

New optional sections; every field is validated on its own (research R9).

```json
{
  "userName": "Traveler",
  "limits": { "replyTokens": 4096, "runSpendUsd": 1 },
  "generation": { "temperature": 1.1, "topP": 0.9, "topK": 40, "minP": 0.05, "repetitionPenalty": 1.05 }
}
```

| Field | Type and range | Default when absent or invalid | Meaning |
|---|---|---|---|
| `userName` | non-blank string (existing) | none; `{{user}}` falls back to `Traveler` | the player's name when no persona is active |
| `limits.replyTokens` | whole number ≥ 0 | 4096 | maximum output tokens per request; 0 = no cap |
| `limits.runSpendUsd` | number ≥ 0 | 1 | spend allowed per app run before asking; 0 = off |
| `generation.temperature` | number 0–2 | not sent | sent as `temperature` |
| `generation.topP` | number 0–1 | not sent | sent as `top_p` |
| `generation.topK` | whole number ≥ 1 | not sent | sent as `top_k` |
| `generation.minP` | number 0–1 | not sent | sent as `min_p` |
| `generation.repetitionPenalty` | number > 0 | not sent | sent as `repetition_penalty` |

An invalid `limits` or `generation` value produces one startup warning naming it (contract).
Settings are read at start; edits apply after a restart.

## Run state (in memory, per app run)

| Name | Where | Meaning |
|---|---|---|
| run spend | app (`sumUsage(records).cost`) | cost of this run's requests with known prices |
| `allowedSpend` | app | starts at `runSpendUsd`; `Continue` adds `runSpendUsd` |
| `retries` | app | `null` after success or a new send; 0 after a fresh failure; +1 per failed retry of the same message |
| notes shown | app | flags so the cut-off note and the unknown-price note appear once per run |
| `replaced` | `CharacterChat` | the reply the latest successful regenerate replaced; cleared by send, regenerate start, chat switch, restart |

## `TurnResult` (engine)

Gains `cutOff: boolean`: true when the provider stopped at the length cap (`stopReason
"length"`). The outcome stays `completed`.

## Trace

`AssemblyTrace` gains `request?: { maxTokens?: number; temperature?: number; samplingParams?:
Record<string, number> }`, which records what `ChatSession` sent.

## Session file

`/prev` appends a copy of the restored reply as a new child of the same user message, so it
becomes the last entry and the current reply after a restart (research R6). Nothing else in the
file format changes.

## State transitions

```text
/prev slots:  none ──(successful regenerate: B replaces A)──▶ replaced=A, shown B
              replaced=A, shown B ──/prev──▶ replaced=B, shown A (copy of A appended)
              any ──(send, regenerate start, chat switch, restart)──▶ none

retries:      null ──(fresh send fails)──▶ 0 ──(retry fails)──▶ 1 ──▶ …
              any ──(reply succeeds, or new message sent)──▶ null

spend:        spend < allowed ──send──▶ sent
              spend ≥ allowed ──send──▶ ask ──Continue──▶ allowed += cap, sent
                                           └─Stop──────▶ not sent, text kept
```
