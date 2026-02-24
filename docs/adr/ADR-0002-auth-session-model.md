# ADR-0002: Authentication and session model

## Status
Accepted (baseline); subject to upgrade in M1

## Context
We use Supabase Auth for login, invites, and password recovery. We need a session model that supports production-grade route protection.

## Decision
- Use Supabase Auth as identity provider.
- Target state: cookie-based sessions usable by server components/middleware (Supabase SSR) for server-enforced route guards.

## Consequences
- If any part of the app relies solely on browser localStorage sessions, server route protection will be limited.
- M1 will align the app to SSR-compatible sessions so middleware can reliably authorize.
