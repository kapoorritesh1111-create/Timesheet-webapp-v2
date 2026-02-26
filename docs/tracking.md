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
## 2026-02-26 — Milestone: Financial Integrity Activated

We converted the timesheet system from a dynamic calculation model to a historical ledger model.

Before:
Payroll totals depended on the current profile hourly_rate and project name.

After:
Each time entry records its own payroll snapshot:
- hourly_rate_snapshot
- role_snapshot
- project_name_snapshot

This ensures payroll exports and historical reports remain accurate after profile or project changes.

This is the foundation required before approvals, locking, and invoicing features.
