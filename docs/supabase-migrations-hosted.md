# Applying Supabase migrations (Hosted Cloud)

Use **Supabase Dashboard → SQL Editor** and run migrations in order from `supabase/migrations/`.

If you are applying to an **existing project**, do NOT run `0001_schema.sql` / `0002_constraints.sql` blindly.
Instead, use these migrations to recreate the schema in a fresh project, or ask for a diff-based patch.
