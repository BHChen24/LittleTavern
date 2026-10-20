# Contract: Assembly API (consumed by 004 and 005)

Exported from `@littletavern/engine`:

```ts
assemblePrompt(input: AssemblyInput): { prompt: AssembledPrompt; trace: AssemblyTrace }
estimateTokens(text: string): number
replaceMacros(text: string, names: { char: string; user: string }): string
DEFAULT_ASSEMBLY_SETTINGS: AssemblySettings
DEFAULT_MAIN_INSTRUCTION: string
```

The types are in `data-model.md`.

## Guarantees

- The function is pure and synchronous. It does no I/O and never throws for any well-typed input.
- The output and trace are deterministic.
- The trace is structured data. Formatting it for people is 005's job.
- `AssembledPrompt` has no pi types. 004 maps it as follows:
  - `system` becomes the agent's system prompt;
  - `history` becomes user and assistant messages;
  - `afterHistory` becomes a trailing system message.

## Not covered by this contract

- Sending the request, or choosing which standalone lorebooks go with a character (004).
- Displaying the trace (005).
