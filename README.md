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

## POC shortcuts (fix before real users)

- `JWT_SECRET` is a plaintext var in `wrangler.toml` — move to `wrangler secret put` and rotate.
- No email confirmation, password reset, or rate limiting on signup.
- Notifications are logged, not emailed (`notify()` in `src/gigs.ts`).
