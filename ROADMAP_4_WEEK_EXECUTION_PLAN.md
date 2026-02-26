🚀 Timesheet v2 – 4 Week Execution Roadmap

Product Identity: Contractor Cost Control & Project Governance System
Version: 1.0
Date Locked: Feb 2026

🎯 Strategic Direction (Non-Negotiable)

We are NOT building:

A simple time tracker

A surveillance tool

A generic HR system

We ARE building:

A structured, financially aware, audit-ready contractor operations platform.

All development must support:

Integrity

Visibility

Governance

Executive clarity

If a feature does not improve one of these, it does not get built.

🗓️ 4 Week Execution Timeline
🔵 WEEK 1 — Financial Integrity Foundation
Goal:

Make time entries audit-grade and immutable.

Milestone 1 — Rate Snapshot Locking
Database Updates

Add to time_entries:

hourly_rate_snapshot

project_name_snapshot

role_snapshot

Behavior

On time entry creation:

Copy profile hourly rate

Copy project name

Copy role

Never calculate from live values again

Outcome

Payroll history becomes historically accurate.

Milestone 2 — Weekly Lifecycle Model

Add status model:

States:

draft

submitted

approved

rejected

locked

Rules

Contractor edits only in draft

Manager approves/rejects

Locked entries cannot be modified

Outcome

We now have structured governance.

Milestone 3 — Basic Audit Trail

Add:

updated_by

updated_at

approved_by

approved_at

Display in drawer view.

Outcome

Traceability and accountability.

🔵 WEEK 2 — Project Financial Intelligence
Goal:

Make Projects financially aware.

Milestone 4 — Budget Model

Add to projects:

budget_hours

budget_amount

start_date

target_end_date

Editable in Project Drawer.

Milestone 5 — Financial Summary Tab

Add “Financials” tab inside Project Drawer.

Display:

Total hours logged

Approved hours

Rejected hours

Total cost (snapshot × hours)

Budget consumed %

Burn progress bar

Estimated completion

Outcome

Projects become cost centers, not folders.

Milestone 6 — Burn Warning Indicators

Visual states:

75% budget → warning

90% → danger

Over budget → red alert

Outcome

Proactive financial control.

🔵 WEEK 3 — Workforce Intelligence
Goal:

Executive visibility layer.

Milestone 7 — Workforce Overview Page

New route:

/admin/workforce

Display:

Active contractors

Total cost this month

Total cost last month

Avg hourly rate

Top 5 projects by spend

Top 5 contractors by hours

Milestone 8 — Utilization Metrics

Per contractor:

Hours this month

% of 40-hour week

Over-utilization indicator

Milestone 9 — Monthly Cost Trend

Add simple 6-month cost line chart.

Outcome

Admin understands workforce financial trajectory.

🔵 WEEK 4 — Workflow & Premium Polish
Goal:

Refine UX and strengthen lifecycle discipline.

Milestone 10 — Structured Submission Flow

Add:

“Submit Week” button

Confirmation modal

Validation (no empty week)

Lock after approval

Milestone 11 — Lightweight Notification System

Initial scope:

In-app notification when week submitted

In-app notification when rejected

Email integration later.

Milestone 12 — Premium UX Polish

Final global pass:

Typography softening

Unified spacing scale

Consistent button sizing

Drawer transition smoothing

Clean empty states

Micro animations

📈 Expected Position After 4 Weeks

We will have:

✅ Immutable financial history
✅ Budget burn visibility
✅ Project cost intelligence
✅ Workforce cost dashboard
✅ Structured approval lifecycle
✅ Executive-level clarity

We will be:

More structured than Clockify
Cleaner than Toggl
More trustworthy than Hubstaff
Lighter than Replicon
More operationally useful than basic trackers

🛑 Guardrails

Do NOT build:

Screenshot monitoring

GPS tracking

HR performance modules

Complex compliance engines

Feature bloat

Stay focused on:
Integrity → Visibility → Governance

🔁 How to Resume Work Each Day

Open new chat and say:

Week X – Milestone Y – Start implementation.

We follow this roadmap strictly.
