# JamWerk — TODO

## Next up (priority order, agreed 2026-08-21)

1. [x] **Notifications batch** — shipped 2026-08-21: Mailjet sending (src/email.ts),
       signup confirmation, password reset, per-IP rate limits on register/login/apply/forgot.
       ⚠ Remaining one-time step: set the TrustAxis Mailjet keys as Worker secrets
       (`npx wrangler secret put MAILJET_API_KEY` / `MAILJET_SECRET_KEY`) — until then
       sends are logged, not delivered. Shared-account note in README "Email".
2. [x] **Applicant cards with names + ratings** — shipped 2026-08-21: display name with
       avatar initials, star average + review count, gigs played, home city, instruments;
       contact email revealed only after booking
3. [x] **Public musician profile pages** — shipped 2026-08-21: /m/:handle, server-rendered
       and shareable (name, instruments, stats, demos, reviews; email never exposed);
       linked from applicant cards and the musician's own profile tab
4. [x] **Web push** — shipped 2026-08-21: VAPID + aes128gcm from scratch on WebCrypto,
       Alerts toggle in the header, pushes ride along with every email notification,
       and new gigs fan out to matching musicians within their travel radius
5. [ ] **Expiry cron** — scheduled job flipping stale open gigs past expires_at to expired
       (fold into whichever of the above ships first)
6. [ ] **Localization: FR / DE / IT / EN** — full app UI, emails, push notifications, and
       public profile pages in all four languages (Swiss market; English included).
       Language picker + browser-language default; TrustAxis's t() helper pattern is a
       reference. Do before promoting outside English-speaking circles.

## Before real users (hardening)

- [ ] Move `JWT_SECRET` out of `wrangler.toml` to `wrangler secret put JWT_SECRET`, rotate the value
- [ ] Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets to this repo so
      `.github/workflows/deploy.yml` deploys on push to main; then delete the temporary
      `deploy-jamwerk.yml` bridge workflow from szkamil/poc-poc
- [ ] Cron trigger to flip stale `open` gigs past `expires_at` to `expired`
- [ ] Custom 404 / error pages; favicon; OG meta for link sharing

## Core loop improvements

- [x] UI refresh: "backstage editorial" direction from the design canvas (Bricolage
      Grotesque + Instrument Sans, ink/violet/paper palette, header waveform + glow,
      violet note-scatter background, segmented board toggle) — shipped 2026-08-21

- [x] Geocode city names on gig post + musician profile (Nominatim, D1-cached) — the board's
      city filter is now "within 25/50/100 km", cards show distance; shipped 2026-08-21
- [ ] Show musician display_name + reviews/rating on applicant cards (data exists, UI shows email)
- [ ] In-app messaging between poster and applicant (currently contact is exchanged on booking)
- [ ] Push/email digest: "new gigs for your instrument within your radius"
- [ ] Musician availability calendar (block dates; hide gigs that clash with a confirmed booking)

## Growth features (sequenced — see "Product ladder" below)

- [x] **Practice partners** (phase 2): listing type alongside gigs — "looking to jam/practice",
      no fee, same instrument/genre/radius matching, same apply flow. Cheap: reuses
      musician_details + the application pattern. Gives musicians a reason to open the app
      weekly even when no paid gigs match.
- [ ] **Band formation** (phase 3): `bands` entity with open seats (instrument slots);
      seat applications reuse the gig application pattern; band page with lineup + genres.
      Ship only once the musician graph is dense enough (see ladder rationale).
- [ ] Later: rehearsal room listings; escrow payments (Stripe Connect) once gig liquidity exists

## Mobile (ladder — web-first, stores when justified)

- [x] **PWA layer**: manifest + icons + service worker + iOS meta tags — jamwerk.app is
      installable from the browser ("Add to Home Screen"); offline shell fallback
- [ ] **Capacitor wrap** (gate: liquidity in seed city + push proven to drive matches):
      same codebase into App Store / Play Store; needs Apple Developer (USD 99/yr) +
      Google Play (USD 25 one-off) accounts, store listings, review cycles
- [ ] Native rebuild only if the UI ever outgrows the web shell (no current need)

## Product ladder (why this order)

Practice (casual, free) → Dep gigs (transactional, the paid core) → Bands (long-term).
The paid-gig loop is the wedge and stays the monetized center; practice partners and band
formation are free retention/graph features that feed it — not separate products. Standalone
band-finder apps die of low urgency and thin liquidity; here they piggyback on supply that
already exists (musician profiles) and on trust built through completed paid gigs.

## Liquidity / go-to-market (not code)

- [ ] Pick one city + one scene (e.g. wedding/cover bands in Bern) and hand-onboard
      ~20 bandleaders; seed the first gigs personally
- [ ] First-gig-free / referral mechanics before any paywall
