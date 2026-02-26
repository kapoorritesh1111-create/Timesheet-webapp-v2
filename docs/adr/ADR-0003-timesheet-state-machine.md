# ADR-0003: Timesheet state machine

## Status
Accepted

## Context
Timesheets require a clear lifecycle so approvals and payroll are consistent.

## Decision
Time entries/timesheets follow:
- `draft` → user editing allowed
- `submitted` → locked for edit except via rejection
- `approved` → included in payroll by default
- `rejected` → editable and must be resubmitted

## Consequences
- UI must reflect lock states.
- DB must enforce/validate transitions (at least via application logic, ideally via constraints/functions).
### Financial Snapshots

On creation of a time entry, the system records immutable payroll snapshots:
- hourly_rate_snapshot
- role_snapshot
- project_name_snapshot

Snapshots are not recalculated after submission or approval.

Rationale:
The timesheet acts as an accounting record, not a dynamic report. Historical payroll must remain correct after employee or project changes.
