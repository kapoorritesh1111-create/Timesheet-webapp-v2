# 🏗️ Architecture Vision – Timesheet v2

## Product Identity
Timesheet v2 is a **Contractor Cost Control & Project Governance Platform**.

It is not:
- A simple time tracker
- A surveillance system
- A generic HR tool

It is:
> A financially aware, audit-ready operational control system for contractor-based teams.

---

# 🧱 System Layers

## Layer 1 — Data Integrity (Non-Negotiable)

All financial calculations must be based on immutable historical values.

### Principles:
- Time entries store `hourly_rate_snapshot`
- Time entries store `project_name_snapshot`
- Time entries store `role_snapshot`
- Approved entries are immutable
- No recalculation from live profile data

If historical accuracy is compromised, the system loses credibility.

---

## Layer 2 — Governance Model

Time must follow a lifecycle:

States:
- draft
- submitted
- approved
- rejected
- locked

Rules:
- Contractor edits only in draft
- Manager approves/rejects
- Locked entries cannot be modified
- All actions tracked with timestamps

---

## Layer 3 — Financial Intelligence

Projects are not folders.
Projects are cost centers.

Each project supports:
- Budget hours
- Budget amount
- Burn tracking
- Cost projection
- Utilization visibility

Financial clarity is the differentiator.

---

## Layer 4 — Workforce Intelligence

Admin must always know:
- Current month cost
- Previous month cost
- Project-level spend
- Contractor utilization
- Rate averages

The dashboard is not cosmetic.
It is operational visibility.

---

# 🛡️ Security Model

- Supabase RLS enforced on all tables
- Org-level isolation
- Role-based access control
- No cross-org leakage

Admin > Manager > Contractor

---

# ⚙️ Technical Stack

- Next.js (App Router)
- Supabase (Auth + Postgres + RLS)
- TypeScript
- Token-based CSS system
- Drawer-based UI architecture

---

# 🚀 Design Philosophy

UI must be:
- Calm
- Structured
- Professional
- Financially serious

Avoid:
- Over-animation
- Bright consumer styling
- Surveillance aesthetics

---

# 📈 Long-Term Direction

Future layers may include:
- Budget forecasting
- Export automation
- Client billing view
- Approval analytics

But never at the cost of integrity.

---

# Final Rule

If a feature does not increase:
- Integrity
- Visibility
- Governance
- Executive clarity

It does not get built.
