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

## Outbound Email

Outbound correspondence is handled by the server route `POST /api/correspondence`, which sends whitelisted booking events through Resend. The browser never receives `RESEND_API_KEY`.

To send real email:

1. Create a Resend account.
2. Add and verify a sending domain in Resend.
3. Create a Resend API key.
4. Add the key and sender settings to `.env.local` or the production host:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="Fit East London <manu@intentionalsets.com>"
EMAIL_REPLY_TO=manu@intentionalsets.com
COACH_NOTIFICATION_EMAILS=manu@intentionalsets.com
```

If `RESEND_API_KEY` is missing, `/api/correspondence` returns `503` so failures are visible during setup.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml` that builds a static export for GitHub Pages. GitHub Pages can host the demo UI, but it cannot run Next.js route handlers or keep server secrets. During the Pages build, the workflow removes server-only routes such as `/api/correspondence` and `/health`.

That means the GitHub Pages version is useful for showing the interface, but real outbound email requires a server runtime such as Vercel, Netlify, Cloudflare Workers, or Supabase Edge Functions.

On GitHub Free, Pages requires a public repository. Private repository Pages requires a paid plan that supports private Pages.

## Database

The initial schema is in `supabase/migrations/20260709113000_initial_schema.sql`.
Regular slot change requests are added in `supabase/migrations/20260709120000_regular_slot_change_requests.sql`.

When the Supabase CLI is available:

```bash
supabase start
supabase db reset
```

The seed data in `supabase/seed.sql` creates four coaches, three members, recurring slots, and two weeks of materialized bookings. Seed identities use unique `manu+...@intentionalsets.com` addresses so local auth remains compatible with the database's unique email rule.

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

## Demo Readiness

Before showing the app:

```bash
pnpm verify
curl http://localhost:3000/health
```

The current demo journeys covered by tests are:

- Account entry: magic-link copy and self-registration pending approval.
- Member journey: enter as demo member, request a regular-slot change, book a makeup slot, cancel a regular booking and get prompted to rebook, join a waitlist.
- Coach journey: enter as demo coach, see the full member roster, select a member to manage, assign a regular slot, approve a regular-slot request, override a full slot for that selected member.

## Implementation Notes

- Member self-registration creates pending profiles; coach-created members are active immediately.
- Cancelling a makeup booking loses the credit rather than extending it.
- Regular recurring slots are coach-managed only. Members may submit change requests, but they cannot create or edit recurring slots themselves.
- Coach-approved future recurring-slot changes replace future materialized regular bookings without generating credits.
- Dashboard counters are lifetime totals.
- Archiving a member cancels future bookings, removes recurring slots, clears waitlists, and preserves history.
- Coaches can override quota, cutoff, capacity, and closures.
