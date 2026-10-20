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
