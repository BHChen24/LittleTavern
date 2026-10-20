# Contract: Chat Safeguards messages and commands

`<log>` is `paths.logFile`, `<settings>` is `paths.settingsFile`, and `<n>` is a number. Names go
through `stripControls`.

## Commands

| Command | Description in `COMMANDS()` and help |
|---|---|
| `/prev` | `Bring back the reply that the last regenerate replaced` |

## Failure notices (error style)

| Kind (`describeProviderError`) | Text |
|---|---|
| `rate-limited` | `The reply failed: rate limit reached. Press Ctrl+R or use /regenerate to retry. Retries so far: <n>. Details: <log>` |
| `network` | `The reply failed: network error. Press Ctrl+R or use /regenerate to retry. Retries so far: <n>. Details: <log>` |
| `other` | `The reply failed. Press Ctrl+R or use /regenerate to retry. Retries so far: <n>. Details: <log>` |
| `key-rejected` | `OpenRouter rejected the key. Type /apikey to replace it. Details: <log>` |
| `no-credit` | `OpenRouter reports insufficient credit. Add credit on openrouter.ai, then retry. Details: <log>` |
| `model-unavailable` | `The selected model is unavailable. Choose another with /model. Details: <log>` |
| Innkeeper, retryable kinds | the same text with `Send your message again to retry.` instead of the Ctrl+R sentence, and no retry count |

The partial reply's suffix is ` (incomplete, not saved)`; with no partial text, the reply line
shows only `(incomplete, not saved)`.

The log entry is `level: error`, `msg: "Provider request failed"`, with `error`, `model`, `kind`
and pino's `time`, with secrets removed.

## Limits

| Situation | Text |
|---|---|
| Reminder line (home screen, pre-chat setup notice) | `Limits: replies up to <replyTokens> tokens, $<runSpendUsd, 2 decimals> per run. Change them in <settings>.` A limit set to 0 reads `replies not capped` or `spending not capped` |
| Spend cap picker title | `This run has spent $<spent, 2 decimals> of $<allowed, 2 decimals>. Send anyway?` |
| Spend cap entries | `Continue (allow another $<runSpendUsd, 2 decimals>)`, `Stop` |
| After `Stop` | `Not sent. Your message is still in the input.` |
| Cut-off note (once per run) | `The reply reached the limit of <replyTokens> tokens and was cut off. Change limits.replyTokens in <settings>.` |
| Unknown prices (once per run) | `Prices for <model> are unknown, so the spending limit cannot be checked for it.` |
| Invalid setting (once, at start) | `Ignored <field> in settings.json: <rule>.`, where `<rule>` is the range in data-model.md, for example `must be a number from 0 to 2` |

## `/prev`

| Situation | Text |
|---|---|
| Swapped | no notice; the transcript shows the restored reply |
| Nothing to bring back | `There is no previous reply to bring back. /prev works right after a regenerate.` |
| Innkeeper or no character chat | `/prev works in character chats.` |
| While a reply streams (also `/new`) | `Wait for the reply, or press Esc to stop it.` |

## Name prompt

| Element | Text |
|---|---|
| Title | `What should characters call you? (Enter saves, Esc uses Traveler for now)` |
| Prefilled value | `Traveler` |
| Empty after cleaning | `Please enter a name.` (the prompt stays open) |
| Saved | `Characters will call you <name>. A persona's name takes precedence.` |

## Trace line

After the header: `Request: max <n> output tokens · temperature <v> · top_p <v> · top_k <v> ·
min_p <v> · repetition_penalty <v>`, listing only the parameters that were sent. With a cap of
0, it reads `no output limit`. With nothing sent at all, it reads `Request: model defaults`.
