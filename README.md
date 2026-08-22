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
- **Logged-out landing** on the front page: what JamWerk is, how it works, one pitch per
  audience (casual jammers vs working musicians), and the alerts feature tout.
- **Experience levels**: musicians can set hobby / semi-pro / pro on their profile (shown on
  applicant cards and public pages), and practice listings state who is welcome — casual
  players are a first-class audience, not an afterthought.

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

**Account: dedicated JamWerk Mailjet account.** The owner has SEVERAL separate
Mailjet accounts — JamWerk uses its **own brand-new account, the one linked to
`gigwerk@hotmail.com`** (NOT the TrustAxis account; do not mix up the key
pairs). The default sender is `gigwerk@hotmail.com`, displayed as "JamWerk".

Deliverability upgrade (recommended once traffic is real): verify the
`jamwerk.app` domain in that same Mailjet account (SPF/DKIM DNS records in
Cloudflare), then switch the sender by setting the `EMAIL_FROM` var/secret to
`notify@jamwerk.app` — a hotmail.com From-address can't carry JamWerk's own
DKIM signature, so inbox placement is second-rate until then.

The API key pair lives only as encrypted Worker secrets, never in this repo:

```
npx wrangler secret put MAILJET_API_KEY     # the gigwerk@hotmail.com account's API key
npx wrangler secret put MAILJET_SECRET_KEY  # its secret key
```

(They can also be pushed via the Cloudflare API `workers/scripts/jamwerk/secrets`
endpoint — same result.)

## POC shortcuts (fix before real users)

- `JWT_SECRET` is a plaintext var in `wrangler.toml` — move to `wrangler secret put` and rotate.
