# 🗄️ Database Migration Checklist – Timesheet v2

This document tracks structural upgrades to maintain integrity and governance.

---

# 🔵 Phase 1 — Financial Integrity

## Add to time_entries

- hourly_rate_snapshot (numeric)
- project_name_snapshot (text)
- role_snapshot (text)

Ensure:
- Populated on insert
- Never recalculated
- Used in payroll calculations

---

## Add lifecycle fields

- status (enum: draft, submitted, approved, rejected, locked)
- approved_by (uuid)
- approved_at (timestamp)
- updated_by (uuid)
- updated_at (timestamp)

Add default:
- status = draft

---

# 🔵 Phase 2 — Project Financial Model

## Add to projects

- budget_hours (numeric, nullable)
- budget_amount (numeric, nullable)
- start_date (date)
- target_end_date (date)

Ensure:
- Financial calculations reference time_entries snapshots
- Burn calculations never depend on profile live rates

---

# 🔵 Phase 3 — Workforce Intelligence Queries

Create safe views for:

- Monthly contractor cost
- Project-level spend
- Contractor utilization
- Monthly trend aggregation

Prefer SQL views over complex client aggregation logic.

---

# 🔐 RLS Review Checklist

For every new column:
- Confirm SELECT policy applies
- Confirm UPDATE restrictions
- Confirm cross-org isolation

Never ship without RLS verification.

---

# 🧪 Pre-Deployment Validation

Before each deploy:

- Verify new columns default values
- Test approval → lock flow
- Test manager cannot edit locked entries
- Test contractor cannot edit approved entries
- Validate payroll uses snapshot rate

---

# 📌 Migration Rule

All migrations must:
- Be idempotent
- Be versioned
- Be documented here

Never make silent DB changes.
