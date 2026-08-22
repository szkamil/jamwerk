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
5. [x] **Expiry cron** — shipped 2026-08-21: daily scheduled Worker run (03:17 UTC)
       expires stale open listings and prunes old rate-limit rows
6. [x] **Advertise the notification features in-product** — shipped 2026-08-21: logged-out
       landing block on the board (hero, how-it-works, alerts pitch with the bell), plus the
       tip already in the signup confirmation email. Still open: dedicated marketing page
       when there is real traction.
7. [ ] **In-app messaging** between poster and applicant — thread per application/seat so
       questions ("can you bring an amp?") happen on-platform before booking; contact
       exchange stays booking-gated. Pairs with existing email+push notifications.
8. [x] **Localization: FR / DE / IT / EN** — shipped 2026-08-21: full app UI (client
       dictionary + header language picker, browser-language default, choice persisted
       per user), all emails and push notifications in the recipient's language, and
       public profile pages in the visitor's browser language.

## Before real users (hardening)

- [ ] Move `JWT_SECRET` out of `wrangler.toml` to `wrangler secret put JWT_SECRET`, rotate the value
- [ ] Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets to this repo so
      `.github/workflows/deploy.yml` deploys on push to main; then delete the temporary
      `deploy-jamwerk.yml` bridge workflow from szkamil/poc-poc
- [ ] Custom 404 / error pages; favicon; OG meta for link sharing

## Core loop improvements

- [x] UI refresh: "backstage editorial" direction from the design canvas (Bricolage
      Grotesque + Instrument Sans, ink/violet/paper palette, header waveform + glow,
      violet note-scatter background, segmented board toggle) — shipped 2026-08-21

- [x] Geocode city names on gig post + musician profile (Nominatim, D1-cached) — the board's
      city filter is now "within 25/50/100 km", cards show distance; shipped 2026-08-21
- [ ] Show musician display_name + reviews/rating on applicant cards (data exists, UI shows email)
- [ ] Push/email digest: "new gigs for your instrument within your radius"
- [ ] Musician availability calendar (block dates; hide gigs that clash with a confirmed booking)

## Growth features (sequenced — see "Product ladder" below)

- [x] **Practice partners** (phase 2): listing type alongside gigs — "looking to jam/practice",
      no fee, same instrument/genre/radius matching, same apply flow. Cheap: reuses
      musician_details + the application pattern. Gives musicians a reason to open the app
      weekly even when no paid gigs match.
- [x] **Band formation** (phase 3) — shipped 2026-08-21: Bands tab (create band with
      instrument seats, seat applications with the enriched applicant cards, owner fills
      seats, contact shared on acceptance, seat fan-out to matching musicians nearby,
      localized notifications). Liquidity caveat from PLAN.md still applies.
- [ ] Later: rehearsal room listings; escrow payments (Stripe Connect) once gig liquidity exists

## Auth

- [ ] **Continue with Google** — one-tap sign-in would cut the biggest registration
      friction, especially on phones. Needs YOUR action first: in Google Cloud Console,
      add https://jamwerk.app/auth/google/callback as an authorized redirect URI on the
      existing OAuth client (the one TrustAxis uses), or create a fresh client for
      JamWerk. Then the flow gets ported from TrustAxis (src/routes/auth.ts there).

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
