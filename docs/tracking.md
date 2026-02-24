# Tracking & Workflow

## Branching
- `main`: always deployable
- feature branches: `feat/m1-<topic>` / `fix/<topic>`

## Issues & labels
Recommended labels:
- `milestone:m1` … `milestone:m5`
- `area:auth`, `area:db`, `area:ui`, `area:approvals`, `area:payroll`, `area:people`
- `risk:high` (auth/RLS/permissions)

## Kanban columns
- Backlog
- Ready
- In Progress
- Review
- Done

## Pull requests
Use the PR template in `.github/pull_request_template.md`. Every PR must include QA steps.
