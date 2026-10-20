# Implementation questions

## Resolved: meaning of constitution principle V

The owner clarified that principle V concerns tool invocations and total token usage during
SDD development. It does not require application context traces. The owner explicitly authorized
correcting the constitution and affected artifacts. Constitution 2.0.0 and the plan's
Constitution Check now reflect that clarification. The implementation blocker is resolved.
Application usage-ledger requirements FR-019–FR-023 remain in scope.

Platform token totals are not exposed by the tools available to this agent. Development usage
is recorded as unknown rather than estimated; tool invocations are recorded in
[development-usage.md](./development-usage.md).

## Testing interface details

The simulated reply list accepts LittleTavern-only history callbacks and error fixtures in
addition to strings. This lets T-h assert the actual second-turn request and T-f simulate
an error containing a synthetic key without importing pi types into tests. The TUI imports
data helpers through the engine public barrel to preserve the existing workspace dependency
chain; no dependency was added.
