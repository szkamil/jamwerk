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
- `src/places.ts` — bundled place list (Grand Genève, Romandie, border towns, Swiss cities; multilingual aliases) + `src/places-api.ts` (`GET /places?q=`: bundled list, then Photon). City inputs use the typeahead in ui.ts; the server refuses unresolvable cities (`code: city_unknown`) — a listing without coordinates would never match anything
- Musicians directory: public `GET /musicians` (instrument / city+radius / looking_for filters) — the *Musiciens* board segment; the board also shows nearby musicians under any empty result. `musician_details.looking_for` = JSON of dep | jam | join_band | start_band
- `src/band-page.ts` — public band page `/b/:id[-slug]` (fee-from, pitch, demos, line-up, "Book" → `/?band=ID` deep link opens the inquiry in the app)
- Bands directory (migration 015): `bands.kind` band|jam, `bookable`/`fee_from`/`fee_currency`/`pitch`; `GET /bands?kind=&bookable=1&genre=&city=&radius_km=`; `PUT /bands/:id` (owner); `POST /bands/:id/inquire` opens a `'band'` message thread (login + confirmed email, 3 new inquiries/day; `band_inquiries` table)
- Direct messages (migration 016): `POST /messages/dm {handle, message}` → `'dm'` thread keyed by `dm_threads` (user pair, `started_by`); gates: login, confirmed email, recipient `musician_details.accepts_dm`, 3 new conversations/day. Buttons on musician cards and `/m/:handle` (`/?dm=<handle>` deep link)
- Chat screen: `renderChat(opts)` in ui.ts is the single conversation view (existing threads via `openThread`, new ones via `openCompose`); full history with day separators, sticky composer, 4s polling with `GET /messages/:type/:id?after=<lastId>`; on phones `body.chat-open` hides site header/footer so the chat fills the viewport above the tab bar. `stopChat()` on any tab change
- Blocking (migration 017, `user_blocks`): `POST /messages/block {thread_type,thread_id | handle, unblock?}`, `GET /messages/blocks`; `isBlocked()` gates DM start, thread replies and band inquiries; blocker's thread list hides the blocked person. New conversations open `openCompose()` (a real conversation page), never `prompt()`
- Nav: bottom bar is Musiciens · Groupes · Jams · Concerts · Messages (+ avatar); Musiciens is the default tab; the Publier tab button exists but is hidden — reached via the intro-card buttons on Concerts/Jams and `[data-tab=post].click()`. `#boardHost` (filters + board) is one DOM node moved between the Musiciens, Concerts and Jams tabs by `mountBoard(tab)`; `#kindSeg` buttons carry `data-group`.
- Cross-wiring: `bandsForUser()` (gigs.ts) → `bands` on `/musicians` rows and a *Groupes* section on `/m/:handle`; band pages link members to `/m/:handle`; `/gigs` rows carry `poster_name`/`poster_handle` (shown as "par X" on cards); `/m/:handle` lists open listings linking to `/?gig=ID` (board opens scrolled to `#gig-ID`). "Mes concerts" lives under Profile as *Mon activité* (`refreshActivity()` badge on the avatar)
- Bands: `POST/DELETE /bands/:id/cover` (R2 `covers/…`, client `resizeCover` 1200×675 JPEG), `POST /bands/:id/inquiries/:inqId/done` (owner; mails the organiser `/?review_band=ID`), `POST /bands/:id/reviews {rating, comment}` (only after done; upsert); `avg_rating`/`review_count` on list, detail and `/b` page (migration 023)
- `src/digest.ts` `sendWeeklyDigests(env)`: Mondays (daily cron), users with digest=1, a located profile, no push subscription, ≥7 days since last; lists paid gigs / jams / new bands within travel radius from the last 7 days. `users.digest`, `digest_sent_at` (migration 022); toggle in Profil settings via `POST /auth/prefs`. Chat: `seen_up_to` on thread GET → "Vu" under the last own bubble. Board: 📍 button sets `fCity` dataset lat/lng from geolocation (`/gigs` and `/musicians` accept lat/lng)
- `src/admin.ts`: `POST /report {type:user|gig|band, id | thread_type+thread_id, reason}` (mails FEEDBACK_EMAIL); `/admin` (HTML) + `/admin/stats` + ban/unban/hide-gig/delete-band/resolve, gated by `isAdmin()` = ADMIN_EMAIL ?? FEEDBACK_EMAIL; `backupToR2()` runs in the daily cron. `users.banned` (migration 021) logs the user out in authMiddleware and blocks login. `GET /auth/export`, `DELETE /auth/account {password}` (FK cascades + R2 photo)
- `fanOutGig(env, gig, urgent)` (gigs.ts) is the single alert fan-out (post + cron fallback of unanswered standbys); it skips `musician_details.unavailable_until >= today` (migration 020, profile toggle "Je ne suis pas dispo"). `notifyEnv()` in email.ts is the context-free notify for cron. Client `fmtDate()` renders human dates.
- Replacement vs standby gigs (migration 018 `gigs.need`, `standby_activated_at`): `POST /gigs/:id/applications/:appId/shortlist` (keep on standby), `POST /gigs/:id/activate-standby` (owner; pings all shortlisted), `POST /gigs/:id/confirm` (shortlisted musician; first wins via `bookApplication()`); `/gigs` rows carry `need`, `standby_activated_at`, `my_status` for the viewer; cron reopens activated standby gigs as `dep` after 2 h. UI: `gigActions()` = one plain-language button/state chip per card; onboarding checklist `renderOnboard()`; `askLine()` feedback prompt at the end of every list
- E-mails: `renderEmail(subject, text, lang)` in email.ts wraps every mail (notify, confirm, reset, feedback) in the branded table layout — ink header, violet bar, card, CTA button for the first URL in the text (label by URL: confirm/reset/open), 4-lang footer. Preview: `docs/email-preview.html` (regenerate with a tsx script calling renderEmail)
- `src/about-page.ts` — `/about` (story, what it is, contact, `#terms` 7-clause terms of use, `#privacy`) ×4 langs; `?lang=` override. Sign-up requires `accept_terms: true` (400 `terms_required` otherwise) and stores `users.terms_accepted_at` (migration 019)
- Deep links on `/`: `?tab=jams|band|help`, `?band=ID`, `?dm=handle`, `?gig=ID`, `?feedback=1`
- `src/genres.ts` — fixed genre list (slugs) + labels ×4 + `normGenres()` (maps legacy free text / any-language labels to slugs; applied on write and on read). Client renders checkbox groups from `GENRES`/`GENRE_LABELS`; never store free-text genres
- `src/media.ts` — demo/promo URL → embed descriptor (YouTube/Vimeo/Spotify/SoundCloud), used by the public profile page and the bands API
- Profile photos: client resizes to a 512px JPEG, `POST /auth/photo` stores it in the R2 bucket `jamwerk-media` (binding `MEDIA`), served at `/img/avatars/<uuid>.<ext>` with immutable caching; `users.photo_key`
- `schema.sql` — full-schema mirror; `migrations/NNN_*.sql` — incremental
  patches for the already-provisioned prod DB. Keep BOTH in sync for any
  schema change. Prod D1: `jamwerk-db`, id `9b956c5a-b8e2-41e4-930c-8a647501b6cb`.
  Migrations 001–023 are applied to prod.
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
  push skips, geocode off via `GEOCODE_OFF` (bundled places still resolve), Turnstile skips without
  secret) — keep it that way so tests run offline.
- Dialogs are modal: error/success feedback must render INSIDE the dialog
  (see `fbMsg`/`fbDone`, `authMsg`), not via the page toast. The page-level
  `#flash` toast is position:fixed top-of-viewport for non-modal contexts.
- Bump the service-worker `VERSION` in `src/pwa.ts` when the app shell
  changes materially (currently `jamwerk-v3`).
- Privacy rule: contact emails are only revealed on booking/acceptance;
  everywhere else show display names.

## Deploying

Tests must pass first. `.github/workflows/deploy.yml` runs the tests and
deploys on every push to `main` (repo secrets `CLOUDFLARE_API_TOKEN` — token
"jamwerk-github-deploy", scoped to the account + jamwerk.app zone — and
`CLOUDFLARE_ACCOUNT_ID`; set 2026-08-22). So: merge to main = deploy. From an
authenticated machine `npx wrangler deploy` still works for hotfixes; Worker
secrets survive deploys. The old poc-poc bridge workflow (`deploy-jamwerk.yml` on branch
`claude/musician-matching-app-wefw3d`) is obsolete and should be deleted.

Prod schema changes: run the new migration against prod D1 (dashboard, MCP
`d1_database_query`, or `npx wrangler d1 execute jamwerk-db --remote --file …`)
BEFORE deploying code that needs it.

## Production configuration (state as of 2026-08-22)

Worker secrets (values live only in Cloudflare; set with `wrangler secret put`):
`JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK` (moved out of
wrangler.toml and rotated 2026-08-22), `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`,
`TURNSTILE_SECRET_KEY`. Tests get throwaway values from vitest.config.mts.

Vars in `wrangler.toml`: `BASE_URL`, `EMAIL_FROM`, `FEEDBACK_EMAIL`,
`VAPID_SUBJECT`.

**Mailjet**: JamWerk uses its OWN dedicated Mailjet account — login
**gigwerk@hotmail.com**, account name "Gig Werk" — NOT the TrustAxis account
(the owner has several; do not mix key pairs). `jamwerk.app` is validated
(ownership, DNS record) and authenticated (SPF/DKIM OK, DMARC p=none) there
since 2026-08-22; sender is `notify@jamwerk.app`, `gigwerk@hotmail.com` is a
validated fallback. Lesson: Mailjet's UI "Validate" button may silently do
nothing — `scripts/mailjet-check.sh APIKEY SECRET` validates through the API.

**Turnstile**: widget "jamwerk.app forms" (managed mode), sitekey
`0x4AAAAAAEYYdK6F0t8OOUQr` hardcoded in `src/ui.ts`; protects
`/auth/register` and `/feedback` server-side via `src/turnstile.ts`.

**Feedback** submissions land in the `feedback` D1 table and are forwarded
to `FEEDBACK_EMAIL` by email.

## Where the work is tracked

`TODO.md` is the living backlog (priorities, pending owner actions, shipped
log). `PLAN.md` holds the product strategy/ladder (practice → paid gigs →
bands → forum) and monetization thinking. Keep both current as you ship.
