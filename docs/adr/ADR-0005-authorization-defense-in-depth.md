# ADR-0005: Authorization defense in depth

## Status
Accepted

## Context
Client-side guards alone are insufficient for production security.

## Decision
- Defense in depth:
  1) DB RLS for data access
  2) Server-enforced route guards (middleware/server components)
  3) Client guards only for UX

## Consequences
- We will implement middleware/server checks in M1.
- Routes must define required roles explicitly.
