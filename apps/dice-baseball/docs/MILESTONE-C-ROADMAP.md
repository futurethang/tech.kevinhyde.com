# Milestone C Roadmap (Future Enhancement)

Status: Planned (not required to begin UX refinement)

## Goal
Formalize the UX automation lab into a robust evidence pipeline for repeatable review, collaboration, and CI regression control.

## Scope

1. Artifact Pipeline (always-on)
- Enable video, trace, and screenshot capture for every scenario run.
- Write a compact run summary JSON (scenario, seed, duration, turn count, pass/fail).
- Persist artifacts under timestamped run folders.

2. Root UX Lab Commands
- Add root-level scripts to run curated workflows:
  - `ux:smoke`
  - `ux:review`
  - `ux:fullgame`
  - `ux:disconnect`
- Support env overrides for seed, speed, and turn limits.

3. Report UX
- Generate and open a Playwright HTML report after local runs.
- Include links from summary JSON to artifacts for fast triage.

4. CI Profiles
- Add headless CI mode with deterministic seed.
- Split suites:
  - fast gate (smoke)
  - deep UX (matrix)
- Upload artifacts from failing jobs.

5. Reliability Guardrails
- Add bounded waits tied to `data-testid` anchors.
- Add flaky-test diagnostics and retry policy only where justified.
- Document expected run-time budgets per scenario.

## Deliverables
- Root scripts and documented run matrix
- Artifact folder conventions
- Summary JSON schema
- CI workflow updates for fast/deep suites
- Updated docs for developers and QA reviewers

## Exit Criteria
- A reviewer can run one command and get:
  - deterministic scenario execution,
  - browsable report,
  - artifact bundle,
  - pass/fail summary.
- CI reliably detects UX regressions with attached evidence.
