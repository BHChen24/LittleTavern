# Implementation notes: 003-prompt-assembly

- The data-model tables describe defaults without TypeScript optional-property syntax.
  AssemblyInput marks userName, contextWindow, settings and the zero-or-more standalone
  lorebooks as optional so those defaults can be used. Character and history remain required.
- FR-002 describes an ordered message list, while the plan, data model and API contract
  explicitly choose system/history/afterHistory. Implement that specified representation;
  conversion to provider messages remains 004's responsibility.
- Total token estimates count the joined system text (including its separators), each kept
  history message and afterHistory. Individual part estimates are rounded independently, so
  adding them need not equal the estimate of the joined text. History fitting uses that same
  joined-system estimate, as R7 requires. An already oversized system with empty history also
  produces the context-window note.
- R5 explicitly requires ignored-feature notes to read entry.source, not normalized fields.
  Secondary-key and regex-key notes therefore inspect the card/world-info raw field names
  (secondary_keys/keysecondary and keys/key); secondaryKeys is also recognized if present
  in the raw source. Normalized-only values do not invent a raw-source feature note.
- Numeric placement takes precedence over string placement, including an unsupported numeric
  value: it goes after and receives the required ignored-feature note.
- T014's scripted greetings do not necessarily activate Seraphina's entries. To avoid a
  vacuous placement check, the local test checks placementOf for all four imported entries,
  as well as the placement of any included trace decisions. Excluded decisions retain the
  data model's optional placement field rather than claiming they were placed in the prompt.
