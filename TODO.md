# JamWerk — TODO

## Before real users (hardening)

- [ ] Move `JWT_SECRET` out of `wrangler.toml` to `wrangler secret put JWT_SECRET`, rotate the value
- [ ] Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets to this repo so
      `.github/workflows/deploy.yml` deploys on push to main; then delete the temporary
      `deploy-jamwerk.yml` bridge workflow from szkamil/poc-poc
- [ ] Rate limiting on register/login/apply (per-IP, D1 table or Turnstile)
- [ ] Email sending: replace the `notify()` console stub in `src/gigs.ts` (Mailjet or Resend);
      wire signup confirmation + password reset
- [ ] Cron trigger to flip stale `open` gigs past `expires_at` to `expired`
- [ ] Custom 404 / error pages; favicon; OG meta for link sharing

## Core loop improvements

- [x] UI refresh: "backstage editorial" direction from the design canvas (Bricolage
      Grotesque + Instrument Sans, ink/violet/paper palette, header waveform + glow,
      violet note-scatter background, segmented board toggle) — shipped 2026-08-21

- [ ] Geocode city names on gig post + musician profile (Nominatim) so radius search actually
      has coordinates; "gigs near me" as the default board view
- [ ] Show musician display_name + reviews/rating on applicant cards (data exists, UI shows email)
- [ ] Public musician profile pages (demo embeds, review history, gigs played)
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
- [ ] Web push notifications ("new gig for your instrument near you") — works on Android
      and on iOS for installed PWAs; push is the killer feature for short-notice deps
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
