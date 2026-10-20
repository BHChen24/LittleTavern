# Implementation Questions: Pickers Instead of Ids

## Resolved implementation details

- Lorebook picker values use a small local discriminated union for import, embedded, library and
  missing entries. This keeps the selection handler explicit without a new component or storage.
- App-harness tests share local fixture helpers in `app-pickers.test.ts`; all cards and lorebooks
  are generated in temporary directories. Symlink creation is skipped on Windows, consistent
  with the existing import tests.

## Open behavior questions

None so far. The updated design resolves the earlier analysis findings.
