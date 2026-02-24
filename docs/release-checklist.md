# Release Checklist

## Pre-release
- [ ] DB migrations applied (and verified) in target environment
- [ ] Vercel environment variables verified
- [ ] Supabase Auth redirect URLs verified

## Smoke tests
- [ ] Login works
- [ ] Invite link → onboarding/reset flow works
- [ ] Create time entry (draft)
- [ ] Submit timesheet
- [ ] Approve / Reject (manager/admin)
- [ ] Payroll/Reports render without errors
- [ ] Role access sanity check (contractor cannot access admin/approvals)

## Post-release
- [ ] Check logs for auth/DB errors
- [ ] Confirm RLS policies behaving as expected
- [ ] Tag release in git (e.g., `release-YYYYMMDD`)
