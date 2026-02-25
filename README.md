# Timesheet v2 — Multi-Tenant SaaS (Baseline v2.0)

A multi-tenant Timesheet SaaS built with:

* **Next.js 14 (App Router)**
* **TypeScript**
* **Supabase (Auth + Postgres + RLS)**
* Custom SaaS UI shell inspired by **Monday.com**

This document reflects the **stable end-of-day baseline** before UI/UX refinements begin.

---

# 🎯 Product Vision

Build a modern SaaS-grade time tracking and approval system with:

* Clean directory-style admin management
* Right-side drawers for editing (Monday.com pattern)
* Role-based access (admin / manager / contractor)
* Strong RLS + server-side enforcement
* Scalable multi-tenant org structure

---

# 🟢 Current Deployment Status

**Deployment:** Stable
**Baseline locked:** Yes
**Step 19/20:** Reverted (not applied)
**Regression state:** Clean and working

---

# 🏗 Architecture Overview

## Frontend

* App Router structure
* Sidebar navigation (Home, My Work, Approvals, Projects, People, Payroll)
* Header with profile dropdown
* Drawer-based editing system

UI style direction:

* Dark SaaS theme
* Token-based styling
* Compact spacing
* Tag-style status indicators

---

## Backend (Supabase)

### Auth

* Supabase Auth
* Email invite flow
* `/auth/callback` redirect
* Onboarding flow enforced

### Database

Core tables include:

* `orgs`
* `profiles`
* `projects`
* `project_members`
* `time_entries`

### Security Model (Defense-in-Depth)

1. UI role gating
2. Admin API validation (checks real session token)
3. Supabase RLS
4. Trigger guards (e.g., `guard_profiles_update`)

---

# 👥 Role Model

## Admin

* Invite users
* Assign managers
* Assign project access
* Edit user roles
* Activate / deactivate users
* View org snapshot

## Manager

* View assigned contractors
* Approve time entries
* Update contractor profiles (per rules)

## Contractor

* Submit time entries
* Update limited profile fields

---

# 📂 Core Routes (Working)

## Admin

### `/admin`

* Org snapshot
* User counts
* Project counts
* Hours this month
* Directory actions
* “New invite” drawer

### `/admin/invite`

* Invite flow via drawer
* Create user (service role)
* Create profile
* Assign manager
* Assign project access

### `/admin/users`

* Directory table
* Search
* Role filter
* Status filter (active/disabled)
* Row click opens drawer
* Drawer sections:

  * User details
  * Project access
* Save changes
* Activate / deactivate user

### `/admin/invitations`

* Pending invites list
* Status display

---

## People

### `/profiles`

* Directory of profiles
* Basic editing functionality
* Manager relationships visible

---

## Projects

### `/projects`

* Project list
* Status indicators
* Project membership relationships working

---

## Timesheet

### `/timesheet`

* Time entry creation
* Entry persistence
* Role-based access enforced

---

## Approvals

### `/approvals`

* Manager/admin approval flow
* State-based transitions

---

## Payroll

### `/payroll`

* Payroll overview

### `/reports/payroll`

* Payroll reporting route

---

# 🔐 Admin API Endpoints (Server-Side)

Located under:

```
/src/app/api/admin/*
```

Key endpoints:

* `POST /api/admin/invite`
* `GET /api/admin/users`
* `GET /api/admin/invitations`

Pattern:

1. Validate caller token
2. Confirm role = admin
3. Use `SUPABASE_SERVICE_ROLE_KEY`
4. Perform privileged operations

---

# 🧠 What Is Stable Right Now

✔ Login & onboarding
✔ Invite user
✔ Create profile row
✔ Assign manager
✔ Assign project membership
✔ Edit user role
✔ Activate / deactivate user
✔ Users drawer UI functional
✔ Org snapshot dashboard
✔ Project membership persistence
✔ RLS enforcement functioning

---

# ⚠ Known Technical Realities

* Step 19 introduced route coupling issues (reverted)
* Some pages still have inconsistent spacing
* People page UX not yet SaaS-level
* Invitations page needs visual redesign
* Drawer component not yet centralized (duplicated structure)
* Table layouts vary across pages
* No shared DataTable abstraction yet
* No shared Drawer abstraction yet

---

# 🎨 UX Maturity Assessment (Honest)

### Current Level: Early SaaS Beta

Strengths:

* Solid architecture
* Real RLS enforcement
* Real multi-role logic
* Drawer interaction pattern present
* Clean navigation shell

Weaknesses:

* Inconsistent table spacing
* Some filters misaligned
* Visual hierarchy not unified
* No system-level component library
* Some density mismatches vs Monday.com

---

# 🚀 Next Phase Roadmap (Starting Tomorrow)

## Phase 1 — UI System Foundation (No DB Changes)

1. Build shared `Drawer` component

   * Header
   * Tabs
   * Scrollable body
   * Sticky footer with buttons

2. Build shared `DataTable` component

   * Column definition
   * Row click
   * Empty state
   * Loading state
   * Tag rendering
   * Actions dropdown

3. Build shared `FormField` component

   * Label
   * Help text
   * Error display
   * Consistent spacing

---

## Phase 2 — Page Refinement

Order:

1. Admin Invitations (weakest visually)
2. Admin Users (alignment + density polish)
3. People page redesign to match Admin Users pattern
4. Approvals polish
5. Timesheet week UI improvements

---

## Phase 3 — SaaS Polish

* Status chips standardized
* Confirmation modals
* Toast notifications
* Optimistic UI updates
* Skeleton loading states
* Error boundaries

---

# 🧪 Regression Checklist (Before Every Deploy)

Auth:

* Login works
* Onboarding works
* Logout works

Admin:

* Invite works
* Profile row created
* Drawer saves properly
* Project membership updates
* Disable user works

Timesheet:

* Entry creation works
* Approval works

---

# 🏁 Baseline Locked

This README represents the stable state at the end of today.

All new work from tomorrow forward should:

* Be incremental
* Avoid deleting working glue logic
* Avoid multi-file refactors in one step
* Follow Monday.com visual patterns gradually

---

# 🧭 Design Reference

Primary inspiration:

* Monday.com Admin + Directory UX
* Right-side drawer editing
* Clean table grids
* Clear visual hierarchy
* Compact but readable density

---

If you want, tomorrow we can:

* Start with a **UI system blueprint**
* Or rebuild **Admin Invitations page first**
* Or create a visual style token cleanup plan

You made the correct move freezing today’s repo.
Tomorrow we move forward cleanly and intentionally.
