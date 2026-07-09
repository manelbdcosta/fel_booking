# Fit East London Booking

Mobile-first booking, rescheduling, credits, waitlist, and coach admin for Fit East London's small-group PT sessions.

## Stack

- Next.js App Router with TypeScript
- Cloudflare Workers via OpenNext
- Cloudflare D1 for member, auth, schedule, booking, credit, and waitlist data
- Email magic-link auth backed by D1 sessions
- SQL migrations for schema, constraints, and seed data
- Resend for transactional email
- Tailwind CSS for the interface
- Vitest for business-rule tests

The key booking invariants live in server route handlers backed by normalized D1 tables. Capacity, quota, cutoff, waitlist, credit, and coach override checks still need more hardened transaction/concurrency work before this should be considered complete for high-contention production use.

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
| `AUTH_TOKEN_PEPPER` | Secret pepper used when hashing sign-in tokens |
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

Outbound correspondence is handled by server route handlers, which send whitelisted booking events through Resend using a server-side HTTPS request to `https://api.resend.com/emails`. The browser never receives `RESEND_API_KEY`.

To send real email:

1. Create a Resend account.
2. Add and verify a sending domain in Resend.
3. Create a Resend API key.
4. Add the key and sender settings to `.env.local` or the production host:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="Fit East London <info@intentionalsets.com>"
EMAIL_REPLY_TO=manu@intentionalsets.com
COACH_NOTIFICATION_EMAILS=manu@intentionalsets.com
```

If `RESEND_API_KEY` is missing, email-sending routes return `503` so failures are visible during setup. If Resend rejects a send, the server logs and returns the Resend HTTP status and response body.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml` that builds a static export for GitHub Pages. GitHub Pages can host the demo UI, but it cannot run Next.js route handlers or keep server secrets. During the Pages build, the workflow removes server-only routes such as `/api/correspondence` and `/health`.

That means the GitHub Pages version is useful for showing the interface, but real outbound email and persistence require a server runtime such as Cloudflare Workers.

On GitHub Free, Pages requires a public repository. Private repository Pages requires a paid plan that supports private Pages.

The GitHub Pages demo is not connected to the Cloudflare D1 database. Booking and coach-management changes are held in browser state only, so they reset when the page reloads.

## Cloudflare

The production Cloudflare Worker is configured in `wrangler.jsonc` and is deployed at:

```text
https://fiteast-scheduling.intentionalsets.com
```

The Worker uses OpenNext for the Next.js runtime, D1 database binding `DB`, and Resend for outbound email. The D1 migrations live in `migrations/d1`.

The live app stores member signups, member status, recurring slots, regular-slot change requests, auth tokens, sessions, materialized bookings, credits, and waitlist entries in D1. Signups create pending members, coaches can approve pending members, and regular-slot changes are written to D1 through route handlers.

Useful commands:

```bash
pnpm db:migrate:remote
pnpm cf:build
pnpm cf:deploy
```

Outbound email requires the Cloudflare Worker secret `RESEND_API_KEY` and a verified Resend sending domain matching `EMAIL_FROM`.

## Database

The D1 schema and seed data live in `migrations/d1`. The seed data creates four coaches, three members, recurring slots, and initial regular-slot requests.

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
