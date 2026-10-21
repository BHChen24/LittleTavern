# Implementation Questions: Chat Editing

## Open behavior questions

None. The implementation follows the updated artifacts that resolve the earlier analysis.

## Implementation details

- Existing `.gitignore` covers dependency, build, log, temporary, editor and secret artifacts.
  Publishing uses `scripts/build-release.mjs` with a generated `files: ["dist", "examples"]`
  allowlist. No additional ignore file is needed for the private workspace packages.
- The engine's private message-entry helper validates membership and the expected role.
  No new public pi type is exposed.

- Saved-file preservation tests check that the complete original file remains a byte-for-byte
  prefix after undo and either edit. This verifies all earlier records and IDs, with stronger
  preservation evidence than checking the IDs alone.
- Engine tests count completed requests to verify that history changes do not request refunds;
  app tests also assert the unchanged ledger and displayed dollar totals. The engine has no
  separate cumulative usage counter.
- pi's message entry union includes roles LittleTavern never stores. Undo narrows copies to
  user/assistant roles; a session-info name missing from an older file is copied as empty text,
  matching pi's session-name clearing behavior.
