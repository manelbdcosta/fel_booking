# Fit East London Booking

Mobile-first booking, rescheduling, credits, waitlist, and coach admin for Fit East London's small-group PT sessions.

## Stack

- Next.js App Router with TypeScript
- Supabase Auth and Postgres
- SQL migrations for schema, constraints, and booking RPCs
- Resend for transactional email
- Tailwind CSS for the interface
- Vitest for business-rule tests

The key booking invariants should live in Postgres functions and migrations, then be called from server-side Next.js code. Capacity, quota, cutoff, waitlist, credit, and coach override checks need database transactions because waitlist emails can produce simultaneous claims for the same final spot.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

## Environment Variables

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase browser key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for admin jobs and seeds |
| `RESEND_API_KEY` | Resend API key |
| `CORRESPONDENCE_EMAIL` | Current single inbox for app correspondence |
| `EMAIL_FROM` | Sender used for transactional emails |
| `EMAIL_REPLY_TO` | Reply-to address for transactional emails |
| `COACH_NOTIFICATION_EMAILS` | Comma-separated coach notification recipients |
| `APP_URL` | Base URL included in member emails |
| `CREDIT_ON_NO_SHOW` | `true` by default; set `false` to stop no-shows issuing credits |
| `CRON_SECRET` | Shared secret for scheduled job endpoints |

For the current build, correspondence defaults to `manu@intentionalsets.com`.

## Database

The initial schema is in `supabase/migrations/20260709113000_initial_schema.sql`.

When the Supabase CLI is available:

```bash
supabase start
supabase db reset
```

The seed data in `supabase/seed.sql` creates one coach, ten members, recurring slots, and two weeks of materialized bookings. Seed identities use unique `manu+...@intentionalsets.com` addresses so local auth remains compatible with the database's unique email rule.

## Business Rules

Shared constants live in `src/lib/booking-config.ts`:

- Europe/London timezone
- Monday-Friday session days
- 06:30, 07:00, 07:30, 08:00, 08:30 slots
- capacity of 4
- 20:00 previous-day cutoff
- 28-day credit expiry
- 7-day no-show marking window
- `CREDIT_ON_NO_SHOW`

Timezone helpers and DST tests start in `src/lib/timezone.ts` and `src/lib/timezone.test.ts`.

## Scripts

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Implementation Notes

- Member self-registration creates pending profiles; coach-created members are active immediately.
- Cancelling a makeup booking loses the credit rather than extending it.
- Future recurring-slot changes replace future materialized regular bookings without generating credits.
- Dashboard counters are lifetime totals.
- Archiving a member cancels future bookings, removes recurring slots, clears waitlists, and preserves history.
- Coaches can override quota, cutoff, capacity, and closures.
