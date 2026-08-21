# JamWerk

**Local, short-notice, paid dep booking for musicians.** https://jamwerk.app

A bandleader posts "bassist needed, Saturday, Bern, CHF 300, must read charts";
local deps apply with one tap; the poster books one; both sides review after
the gig. Fees are always public — that is the point.

Cloudflare Worker (Hono) + D1, JSON API + single-page UI, all in this repo.

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
