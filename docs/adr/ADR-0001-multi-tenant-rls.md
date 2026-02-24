# ADR-0001: Multi-tenant model and RLS as source of truth

## Status
Accepted

## Context
We are building a multi-tenant timesheet platform where users must only access data within their organization.

## Decision
- All tenant isolation is enforced at the database layer using Supabase/Postgres RLS.
- Every table that is tenant-scoped includes `org_id`.
- Server and client code assume the DB is the ultimate arbiter of authorization.

## Consequences
- RLS policies must be versioned and reviewed like application code.
- All reads/writes must include `org_id` scoping (implicitly via policies or explicitly in queries).
