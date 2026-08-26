# JamWerk — TODO

## ⚡ Pending YOUR action (blockers first)

1. [x] **Mailjet sender** — fixed 2026-08-22: the account's validated sender is
       gigwerk@hotmail.com (mailwerk@hotmail.com never existed as a validated sender);
       EMAIL_FROM switched, test feedback email delivered + opened. The stray pending
       sender "mailwerk@hotmail.com" can be deleted in Mailjet → Senders.
2. [x] **notify@jamwerk.app** — done 2026-08-22. The Mailjet UI "Validate" button never ran a
       check; `POST /v3/REST/sender/<id>/validate` via the API (scripts/mailjet-check.sh) validated
       the domain instantly (ownership by DNS record; SPF/DKIM OK). EMAIL_FROM switched.
       ⚠ The API key pair used for that was pasted in chat — rotate it in Mailjet → API Key
       Management and `wrangler secret put MAILJET_API_KEY / MAILJET_SECRET_KEY` again.
3. [x] Repo Actions secrets `CLOUDFLARE_API_TOKEN` (token "jamwerk-github-deploy", account +
       jamwerk.app zone scoped) + `CLOUDFLARE_ACCOUNT_ID` added 2026-08-22; deploy.yml now
       deploys on every push to main (first green run: version d39cc810). Still to do:
       delete `.github/workflows/deploy-jamwerk.yml` on poc-poc branch
       `claude/musician-matching-app-wefw3d` (the old bridge).
4. [ ] Google Cloud Console: add https://jamwerk.app/auth/google/callback as redirect
       URI → then port "Continue with Google" (see Auth section).
5. [ ] Rotate the Mailjet API keys at some point (they transited chat once).
6. [x] DECIDE: open musician-to-musician DMs — decided 2026-08-22: not during seeding; plan + trigger + anti-abuse rules in PLAN.md "Messaging".

## Shipped 2026-08-26

- Direct messages between musicians (opt-out in profile, confirmed email,
  3 new/day) + bottom-nav rework: Concerts · Jams · Groupes · Messages · Publier;
  Jams tab = partners + jam groups; "Mes concerts" → Profil › Mon activité with
  avatar badge. Migration 016.

- Bands directory: bands list themselves as *band* or *jam / practice group*,
  bookable flag + fee-from (CHF/EUR) + one-line pitch, demos; Groupes tab has
  filters (all / bookable / jam groups, genre, city + radius); public page
  `/b/<id>-<slug>`; "Réserver ce groupe" opens a `band` message thread with the
  owner (confirmed email, 3 new/day); owner can edit the band; landing card
  "Vous organisez un événement ?". Migration 015 rebuilt `messages` CHECK.

## Shipped 2026-08-22 (session log)

- In-app messaging (threads per gig/seat application, unread badge, one nudge per
  catch-up) + "Message sent." toast on send
- Landing: balanced primary CTAs, actionable empty boards ("no gigs/jam partners
  found — enable alerts / register / post"), logo → home link, site footer
- Footer feedback form → D1 `feedback` table + email forward to FEEDBACK_EMAIL;
  in-dialog errors and a green-tick "Message sent" success state replacing the form
- Taglines now cover all three pillars (ribbon "gigs · jams · bands", hero
  "Find a dep. Join a jam. Start a band.", title/manifest/profile footer)
- Filter bar: uniform 46px pills (custom select chevron), radius steps 5–100 km
- Auth dialog button spacing; floating page toast (fixed, top of viewport)
- **Mailjet**: dedicated account (gigwerk@hotmail.com) wired — keys set as Worker
  secrets via Cloudflare API, sender/account notes in code+README
- **Turnstile**: widget created via API, secret on Worker, protects register+feedback
- Deploys #13–#30, all green; migrations applied to prod through 010

## Next up (priority order, agreed 2026-08-21)

1. [x] **Notifications batch** — shipped 2026-08-21: Mailjet sending (src/email.ts),
       signup confirmation, password reset, per-IP rate limits on register/login/apply/forgot.
       ⚠ Remaining one-time step: set the Mailjet keys as Worker secrets — from
       JamWerk's OWN dedicated Mailjet account (login: gigwerk@hotmail.com), NOT the
       TrustAxis account. Until then sends are logged, not delivered. Then: verify the
       jamwerk.app domain in Mailjet and switch EMAIL_FROM to notify@jamwerk.app.
       Account note in README "Email".
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
7. [x] **In-app messaging** — shipped 2026-08-22: thread per gig/seat application,
       participants only, names shown (never emails), Messages tab with unread badge,
       one email+push nudge per catch-up (not per message), Message buttons on applicant
       cards and applications.
8. [x] **Localization: FR / DE / IT / EN** — shipped 2026-08-21: full app UI (client
       dictionary + header language picker, browser-language default, choice persisted
       per user), all emails and push notifications in the recipient's language, and
       public profile pages in the visitor's browser language.

## Before real users (hardening)

- [ ] **Hard email confirmation** — today confirmation is *soft*: accounts work immediately,
      only posting a **paid gig** requires a confirmed address (gate shipped 2026-08-22 with a
      resend-link banner). Revisit once mail reliably lands in the inbox (domain-validated
      sender): require confirmation for applying/messaging too, or for everything.

- [ ] **Rethink where feedback goes** — today `POST /feedback` stores the message in the D1
      `feedback` table and emails a copy to the `FEEDBACK_EMAIL` var in wrangler.toml
      (= rupert.szewczyk@gmail.com, sent from the Mailjet sender). Problems: a personal
      inbox hard-coded in config, no way to reply from a JamWerk identity, and nobody sees
      the D1 rows. Options: (a) `feedback@jamwerk.app` via Cloudflare Email Routing,
      forwarded to whichever inbox handles support (no code change, swap the var);
      (b) keep D1 as source of truth + a tiny admin list (`/admin/feedback`, owner-only);
      (c) pipe into a shared tool (Slack/Notion webhook). DECIDE, then update
      `FEEDBACK_EMAIL` / src/feedback.ts accordingly.

- [x] **Bot protection on public forms** — shipped 2026-08-22: Cloudflare Turnstile
      widget "jamwerk.app forms" (managed mode) created via the API, secret stored as
      the TURNSTILE_SECRET_KEY Worker secret, widget rendered in the register form and
      feedback dialog, token verified server-side (src/turnstile.ts) on /auth/register
      and /feedback. Rate limits stay as the second layer.
- [x] `JWT_SECRET` + VAPID keys moved to Worker secrets and rotated — 2026-08-22
- [x] `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets — done 2026-08-22, CI deploys on push to main; poc-poc bridge still to delete
- [ ] Custom 404 / error pages; favicon; OG meta for link sharing

## Core loop improvements

- [x] **Musicians directory** — shipped 2026-08-25 (first-user feedback: 'no way to find anyone'): public *Musiciens* segment on the board with the same filters, cards → public page, the board shows *Musiciens près de vous* under any empty result, and profiles carry *Je cherche* (remplacements payés / jams / rejoindre / monter un groupe) shown as chips. Later: a 'visible in the directory' opt-out if anyone asks.
- [x] **Typo-proof cities** — shipped 2026-08-23: city fields are a typeahead (bundled list of ~70 places with Genf/Geneva/Ginebra-style aliases, Photon for the rest, biased to Geneva); unknown cities are refused instead of saved without coordinates. Nominatim fallback now biased to CH/FR/DE/IT/AT + Geneva viewbox.
- [x] **Profile photo** — shipped 2026-08-23: R2 bucket `jamwerk-media`, client-side 512px crop/resize, shown on applicant cards, public page (also as og:image) and the header avatar; remove button. No moderation yet (fine at POC scale — every new profile is visible to the owner).
- [x] **Media embeds** — shipped 2026-08-23: demo/promo links on public musician pages and band
      cards render as inline players (YouTube, Vimeo, Spotify, SoundCloud) or link cards
      (Bandcamp, anything else); bands got a `links` field (migration 012). Never host media.

- [x] UI refresh: "backstage editorial" direction from the design canvas (Bricolage
      Grotesque + Instrument Sans, ink/violet/paper palette, header waveform + glow,
      violet note-scatter background, segmented board toggle) — shipped 2026-08-21

- [x] Geocode city names on gig post + musician profile (Nominatim, D1-cached) — the board's
      city filter is now "within 25/50/100 km", cards show distance; shipped 2026-08-21
- [ ] Show musician display_name + reviews/rating on applicant cards (data exists, UI shows email)
- [ ] Push/email digest: "new gigs for your instrument within your radius"
- [ ] **DECIDE: open musician-to-musician DMs** — today a message thread only exists once
      someone applies to a gig/practice listing or band seat (deliberate: no cold-DM spam
      channel). Option: let any logged-in musician message another from their public
      profile page. Needs an anti-spam story first (Turnstile above, plus maybe
      first-message limits or recipient opt-out). Extending src/messages.ts with a third
      thread_type is cheap once decided.
- [x] **EUR fees** — shipped 2026-08-22: `currency` (CHF default / EUR) on gigs and bookings (migration 011), CHF/EUR selector in the post form (remembered per browser), shown as posted on cards, alerts and booking mails. No conversion — a fee is a contract figure. Later, if useful: '≈ CHF' hint with a fixed weekly rate.
- [ ] Musician availability calendar (block dates; hide gigs that clash with a confirmed booking)
- [ ] **Musicians on a map** — PARKED 2026-08-22, not before a city has ~100+ profiles or a
      second region needs a coverage view. Reasoning: with <50 musicians a map is an empty
      Switzerland with three pins — it advertises the cold start that the list + radius filter
      hides; it is a browsing feature while the core loop is alerts (map adds no bookings);
      pins must be city-precision + jittered for privacy, so at that resolution a list grouped
      by city says the same; and it costs a day (Leaflet/OSM tiles, clustering, mobile
      gestures, lazy-load) plus upkeep. Cheap geographic feel instead: distance on musician
      cards ("12 km · Annemasse") and the city filter accepting French border towns.
      When built: a secondary view toggle on the musicians list (not a tab), clustered,
      lazy-loaded only when opened, reused for gigs / practice / band seats as layers.
      Original spec: one pin per musician at city precision, popup = name, instruments,
      level, link to /m/:handle; filters shared with the board.
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
