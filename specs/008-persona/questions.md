# Implementation notes: 008-persona

## Implementation details

- Reuse the safe-card filename helper with an optional extension argument; existing callers retain `.json`. Persona creation uses `.md` and exclusive copying followed by draft removal, preserving the authored bytes.
- Persona parsing uses the shared ordered sections, rejects duplicate known headings and ignores unknown headings as the character parser does.
- Active settings identify a Markdown basename within the persona folder; other path shapes produce the documented fallback notice.
- `readActivePersona` returns `{ persona, notice? }`; no active persona is represented by `null`.

## Unanswered behavior questions

None.
