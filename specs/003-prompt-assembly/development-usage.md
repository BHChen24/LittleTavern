# SDD development usage: 003-prompt-assembly

Platform-reported total development tokens: **unknown**. No usage count is available to
this agent; none is estimated. The conversation tool transcript records each invocation,
its arguments, purpose and outcome. Phase summaries below index that record.

Initialization: `exec_command` checked prerequisites, the clean 003 branch, all 16 completed
checklist items, feature artifacts, constitution, package setup and ignore rules. No hooks
file was present. The pinned pi reference clone is at v1.3.0; its Model type declares
contextWindow as a number. No .env was read, no dependency was installed and no live-provider
or GPU operation was performed.

Phase 1: `apply_patch` created the assembly types/defaults and test-only builders. Optional
input properties represent the defaults documented by the feature. Local fixtures use
empty defaults and generated content only. Validation and checkpoint results follow.

Phase 1 checkpoint: build and lint passed (65 files), and all 114 tests in 21 files passed.
`exec_command` marked T001/T002 complete, and git staged and committed the phase on 003.

Phase 2: apply_patch added token/macro tests and the model-window assertion first; the
targeted test run failed for the expected missing modules and field. It then implemented
CJK-aware code-point counting, literal macro replacement and the pi contextWindow mapping.
Build/lint (69 files) and all 123 tests in 23 files passed. exec_command marked T003–T005
complete and git committed the phase. No dependency, UI or chat behavior changed.
