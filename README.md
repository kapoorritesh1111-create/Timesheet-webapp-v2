# Timesheet Webapp v2 (Next.js + Supabase)

A Monday.com-inspired timesheet + approvals + payroll webapp built with **Next.js (App Router)** and **Supabase** (Auth + Postgres + RLS).
Focus: clean enterprise UI shell, role-based access (admin / manager / contractor), and predictable weekly time tracking.

## Status (Current stopping point)

**UI/UX**

* ✅ Monday-style **AppShell** is live across the app:

  * fixed sidebar
  * sticky top header
  * centered content container
  * profile dropdown menu
  * mobile sidebar drawer behavior
* ✅ **People** directory page has the unified Monday-like toolbar + grid/table layout.
* ✅ **Projects** page moved to the same UI language as People:

  * toolbar density matched
  * row hover matched
  * **selection is now a subtle row highlight + left accent** (no “selected” tag)
  * actions live behind `...` row menu
  * admin flows are clean and consistent
* ✅ **Projects drawer** is implemented (Monday-style right panel).
* ✅ **Settings → My Profile** is upgraded:

  * address fields now match People UX patterns
  * ZIP → auto-populates City/State using a ZIP lookup
  * country defaults to USA
  * structured sections: Personal info + contact details, plus “Coming next” placeholder sections

**Stability**

* ✅ Builds are green and deployable.
* ✅ Accessibility warnings reduced:

  * inputs/selects now have `id/name` patterns and label alignment improvements (where applicable)
* ✅ Projects drawer tab typing/build issues fixed.

---

## Tech stack

* **Next.js 14** (App Router)
* **React + TypeScript**
* **Supabase**:

  * Auth (invites / login)
  * Postgres tables + Row Level Security (RLS)
* CSS: `src/app/globals.css` (token-driven, Monday-style system)

---

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-side only
```

Notes:

* Browser client uses **anon key only** (`src/lib/supabaseBrowser.ts`).
* Server routes use service role key (`src/lib/supabaseServer.ts`).

---

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm start
```

---

## App routes (current)

* `/dashboard` — summary + quick links
* `/timesheet` — weekly time entry
* `/approvals` — approvals (manager/admin)
* `/reports/payroll` — payroll reporting
* `/profiles` — People directory (org users)
* `/projects` — Projects list + drawer detail (admin full control; managers read-only)
* `/admin` — admin hub (invite + org snapshot)
* `/settings/profile` — My Profile (Monday-style profile shell + address)

---

## Role behavior (current)

### Admin

* Full access to everything.
* Can create/edit/deactivate projects.
* Can manage project membership & org directory actions.

### Manager

* Sees projects list and can inspect details.
* Does **not** get admin controls for create/deactivate/membership changes.
* Approvals page expected to show manager scope.

### Contractor

* Focused on timesheet entry + viewing their own data (RLS dependent).

---

## Key features working now

### 1) Monday-style AppShell

File: `src/components/layout/AppShell.tsx`

* sidebar + header unified for all pages
* profile dropdown
* mobile responsive patterns

### 2) People directory UI

File: `src/app/profiles/page.tsx` (and related client)

* filter/search toolbar
* density matched to Monday feel
* consistent row actions and quick scanning

### 3) Projects page polish + drawer

Files:

* `src/app/projects/page.tsx`
* `src/app/projects/projects-client.tsx`
* Drawer panel foundation in CSS: `globals.css`

Highlights:

* toolbar + table now visually aligned with People
* selected row is subtle highlight + left accent bar
* actions behind `...`
* drawer opens with details for selected project

### 4) Settings → My Profile improvements

File: `src/app/settings/profile/page.tsx`

Address behavior (current):

* Address 1 / Address 2
* ZIP
* City + State auto-filled from ZIP lookup (network call)
* Country default: USA

Also includes Monday-style profile navigation with “Coming next” sections:

* Working status
* Notifications
* Language & region
* Password
* Session history

### Payroll Integrity

The system now uses snapshot-based payroll accounting.

Every time entry stores:
- hourly rate at the time of work
- user role at the time of work
- project name at the time of work

This prevents payroll history from changing when employee rates, roles, or project metadata are modified.

This design mirrors enterprise systems such as Replicon and SAP time accounting.
---

## Known gaps / constraints (as of now)

* Some “Coming next” profile sections are placeholder-only for now.
* Console may still show minor autofill/label warnings on specific inputs depending on browser.
* We are still refining typography (font weights feel a bit harsh in places) — next polish item is global typography softening in `globals.css`.
* Manager/contractor experiences need a dedicated pass after admin UX is locked.

---

## What we will do tomorrow (next steps)

### Priority A — Typography polish (global)

Goal: make UI feel less harsh / more “Monday”:

* soften headings/body weights globally
* adjust font-smoothing
* normalize label weights (reduce 900/950 usage in non-headline contexts)
* ensure table headers and tags don’t feel “shouty”

Target file:

* `src/app/globals.css`

### Priority B — Settings “My Profile” completion

Build the real Monday-style profile experience:

* Working status (active/away/custom)
* Notifications preferences (email/in-app toggles)
* Language & region (timezone, locale)
* Password (reset flow entry)
* Session history (basic list; can be mocked if needed)

### Priority C — Projects drawer UX final pass

* Ensure drawer content mirrors People drawer interaction patterns exactly:

  * consistent tabs layout
  * consistent footer actions
  * consistent spacing and density
* Confirm mobile drawer behavior is clean and predictable.

### Priority D — QA pass (admin flows)

* Validate:

  * create project
  * deactivate project
  * assign members
  * People edits
  * profile address save + ZIP lookup behavior

---

## Dev notes / reminders

* If you see Vercel builds “auto-modifying tsconfig”, it’s normal — but we should keep tsconfig stable in repo to avoid churn.
* Address ZIP lookup relies on external API; if we want zero dependencies later, we can replace with:

  * a lightweight ZIP table in Supabase
  * or a paid/enterprise geo provider
