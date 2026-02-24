# ADR-0004: Read model via DB view (`v_time_entries`)

## Status
Accepted

## Context
Payroll, approvals, and reporting should compute hours/totals consistently.

## Decision
- Use a Postgres view (`v_time_entries`) as the canonical read model for computed fields.

## Consequences
- Changes to hour calculation require DB migration.
- App code should avoid duplicating business logic computations.
