# CLAUDE.md — JamWerk

JamWerk (https://jamwerk.app) is a Swiss-focused local musician marketplace:
paid dep gigs with public CHF fees, free jam/practice partners, and band
formation with open seats. Localized EN/FR/DE/IT. It is a completely separate
product from TrustAxis — never mix the two (different repo, Worker, domain,
D1 database, Mailjet account).

## Stack & layout

Cloudflare Worker (Hono, TypeScript) + D1 (SQLite) + wrangler. No build step
beyond wrangler; the whole SPA is served from `src/ui.ts` (a template-literal
page: CSS + HTML + one inline client script + the I18N dictionary).

- `src/index.ts` — entry; mounts routes; daily housekeeping cron (03:17 UTC)
- `src/ui.ts` — the SPA. Also `src/profile-page.ts` (public `/m/:handle`)
- `src/auth.ts` (cookie-JWT, confirm/reset, rate limits), `src/gigs.ts`
  (gig+practice lifecycle, geocode radius search, fan-out notify),
  `src/bands.ts`, `src/messages.ts` (threads per application),
  `src/feedback.ts` (footer form), `src/push.ts` (Web Push from scratch:
  VAPID ES256 + aes128gcm on WebCrypto), `src/email.ts` (Mailjet),
  `src/turnstile.ts` (bot check), `src/ratelimit.ts`, `src/i18n.ts`,
  `src/pwa.ts` (manifest/icons/service worker)
- `schema.sql` — full-schema mirror; `migrations/NNN_*.sql` — incremental
  patches for the already-provisioned prod DB. Keep BOTH in sync for any
  schema change. Prod D1: `jamwerk-db`, id `9b956c5a-b8e2-41e4-930c-8a647501b6cb`.
  Migrations 001–010 are applied to prod.
- `test/*.spec.ts` — @cloudflare/vitest-pool-workers. 44 tests. Run:
  `CI=true npx vitest run`. Isolated per-test D1 storage: multi-step
  lifecycle flows must live in a SINGLE `it` block. Schema is replayed from
  schema.sql by `test/apply-migrations.ts`.
- `design/` — design-canvas artboards ("backstage editorial" system:
  Bricolage Grotesque + Instrument Sans, ink/violet/paper, waveform strip,
  scattered violet note background).

## Conventions that bite if ignored

- Every user-facing string goes through the I18N dictionary in `src/ui.ts`
  (client) or `t(lang, {en,fr,de,it})` (server) — add ALL FOUR languages.
- The inline client script must stay valid standalone JS. Sanity check:
  extract the `<script>…</script>` block and `new Function(it)`.
- External services degrade gracefully when unconfigured (email logs,
  push skips, geocode off via `GEOCODE_OFF`, Turnstile skips without
  secret) — keep it that way so tests run offline.
- Dialogs are modal: error/success feedback must render INSIDE the dialog
  (see `fbMsg`/`fbDone`, `authMsg`), not via the page toast. The page-level
  `#flash` toast is position:fixed top-of-viewport for non-modal contexts.
- Bump the service-worker `VERSION` in `src/pwa.ts` when the app shell
  changes materially (currently `jamwerk-v3`).
- Privacy rule: contact emails are only revealed on booking/acceptance;
  everywhere else show display names.

## Deploying

Tests must pass first. Two paths:

1. **From an authenticated machine** (wrangler login or CLOUDFLARE_API_TOKEN):
   `npx wrangler deploy` — that's it. Worker secrets survive deploys.
2. **Current CI bridge** (until this repo gets its own Cloudflare secrets):
   the workflow `.github/workflows/deploy-jamwerk.yml` in **szkamil/poc-poc**
   (branch `claude/musician-matching-app-wefw3d`) checks out jamwerk@main and
   deploys with poc-poc's secrets. Trigger it by bumping the
   `# Deploy counter: N` comment in that file and pushing. 30 deploys so far,
   all green. Once `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` are added
   to THIS repo's Actions secrets, its own `.github/workflows/deploy.yml`
   takes over — then delete the bridge file from poc-poc.

Prod schema changes: run the new migration against prod D1 (dashboard, MCP
`d1_database_query`, or `npx wrangler d1 execute jamwerk-db --remote --file …`)
BEFORE deploying code that needs it.

## Production configuration (state as of 2026-08-22)

Worker secrets already set (do NOT re-create blindly; values live only in
Cloudflare): `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `TURNSTILE_SECRET_KEY`.

Vars in `wrangler.toml`: `BASE_URL`, `EMAIL_FROM=gigwerk@hotmail.com`,
`FEEDBACK_EMAIL=rupert.szewczyk@gmail.com`, plus POC-only plaintext
`JWT_SECRET` and VAPID keys (moving them to `wrangler secret put` is an open
hardening TODO — rotating VAPID re-prompts all alert subscribers).

**Mailjet**: JamWerk uses its OWN dedicated Mailjet account — the one whose
login is **gigwerk@hotmail.com** — NOT the TrustAxis account (the owner has
several; do not mix key pairs). ⚠ The sender address still awaits validation:
click the link Mailjet sent to the gigwerk@hotmail.com inbox, else sends are
held. Later: verify the jamwerk.app domain in Mailjet (SPF/DKIM records into
Cloudflare DNS) and switch `EMAIL_FROM` to `notify@jamwerk.app`.

**Turnstile**: widget "jamwerk.app forms" (managed mode), sitekey
`0x4AAAAAAEYYdK6F0t8OOUQr` hardcoded in `src/ui.ts`; protects
`/auth/register` and `/feedback` server-side via `src/turnstile.ts`.

**Feedback** submissions land in the `feedback` D1 table and are forwarded
to `FEEDBACK_EMAIL` by email.

## Where the work is tracked

`TODO.md` is the living backlog (priorities, pending owner actions, shipped
log). `PLAN.md` holds the product strategy/ladder (practice → paid gigs →
bands → forum) and monetization thinking. Keep both current as you ship.
