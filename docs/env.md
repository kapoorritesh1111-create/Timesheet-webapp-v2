# Environment Variables

## Required

### Public (available in the browser)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `NEXT_PUBLIC_SITE_URL` — canonical site origin (used for auth redirects). Example: `https://your-app.vercel.app`

### Server-only
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key. **Never** reference this from client components.

## Local setup
1. Copy `.env.example` to `.env.local`
2. Fill values
3. Run `npm install` and `npm run dev`

## Security rules
- Do not commit `.env.local`
- Do not log secrets
- Service role key must only be used in server contexts (Route Handlers / Server Actions)
