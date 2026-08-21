# JamWerk

**Local, short-notice, paid dep booking for musicians.** https://jamwerk.app

A bandleader posts "bassist needed, Saturday, Bern, CHF 300, must read charts";
local deps apply with one tap; the poster books one; both sides review after
the gig. Fees are always public — that is the point.

Cloudflare Worker (Hono) + D1, JSON API + single-page UI, all in this repo.

## Features

- **Gig board** with paid gigs and free practice-partner listings; public fees
  in CHF; instrument, city, and radius filters (real geocoded radius search,
  distance shown on cards).
- **Booking flow**: apply with one tap, poster books one musician (others are
  declined automatically), completion unlocks two-sided reviews. Applicant
  cards show names, star ratings, and gigs played — contact is shared only
  after booking.
- **Public musician pages** at `/m/:handle` — shareable track record: demos,
  reviews from completed gigs, stats.
- **Notifications, email + web push together.** Every notification that goes
  out by email also arrives as a push on subscribed devices: application
  received, you're booked, practice match, gig cancelled.
- **New-gig fan-out** — posting a gig sends "Gig: bass in Bern — CHF 300" to
  every musician playing that instrument within *their own* travel radius of
  the venue (email + push). This is the short-notice-dep killer feature.
- **Tapping a push notification opens or focuses the app.** Alerts are enabled
  with the bell button in the header; works on Android/desktop browsers and on
  iOS once the PWA is installed to the home screen.
- **Installable PWA** with offline shell.

⚠ These features are invisible until someone tells users about them — see the
"Advertise the notification features" item in TODO.md.

## Develop

```
npm install
npm test          # vitest (workers pool, ephemeral D1)
npm run dev       # wrangler dev on localhost
```

## Deploy

`.github/workflows/deploy.yml` tests and deploys on every push to `main`.
It needs two repository secrets (Settings → Secrets and variables → Actions):
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Schema changes: `schema.sql` is idempotent; apply it to the `jamwerk-db` D1
database with `npx wrangler d1 execute jamwerk-db --remote --file schema.sql`.

## Email (Mailjet)

Transactional email (gig notifications, signup confirmation, password reset)
goes through Mailjet — `src/email.ts`. Without keys configured the app still
runs; sends are skipped and logged.

**⚠ Shared account — deliberate, temporary.** JamWerk currently uses the
**existing TrustAxis Mailjet account's** API key pair, and sends from the
TrustAxis-verified sender `outreach@trustaxis.ch` (display name "JamWerk"),
because that sender is the one the account has verified. When JamWerk is
viable and gets traffic, move it to a **dedicated Mailjet account**:

1. Create the account, get a fresh API key + secret.
2. Verify the `jamwerk.app` domain there (SPF/DKIM DNS records in Cloudflare).
3. `npx wrangler secret put MAILJET_API_KEY` / `MAILJET_SECRET_KEY`, and
   `npx wrangler secret put EMAIL_FROM` with `notify@jamwerk.app`.

To enable sending today (one-time, from a checkout of this repo):

```
npx wrangler secret put MAILJET_API_KEY     # paste the TrustAxis account's API key
npx wrangler secret put MAILJET_SECRET_KEY  # paste its secret key
```

(The same values TrustAxis production uses; they live only as encrypted Worker
secrets, never in this repo.)

## POC shortcuts (fix before real users)

- `JWT_SECRET` is a plaintext var in `wrangler.toml` — move to `wrangler secret put` and rotate.
