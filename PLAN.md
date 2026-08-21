# JamWerk — Product & Build Plan

One musician graph, three rungs of commitment, one community layer — shipped in
liquidity order. The paid-gig loop stays the monetized core; everything else
exists to keep musicians in the app between paid gigs and to densify the graph
that feeds them.

## Phase 2a — Practice partners (build now)

"Looking to jam": free listings next to paid gigs. Same matching dimensions
(instrument, genres, city/radius), same apply flow, no money, no single winner.

Mechanics — a listing *kind* on the existing gigs table, not a parallel system:

- `gigs.kind` = `'gig' | 'practice'`. For practice: no fee, no fixed date
  (description carries "Tuesdays, weekly"), expiry 60 days from posting.
  Constraints keep paid gigs strict: fee + date remain mandatory for `kind='gig'`.
- Apply is identical. Accept differs: no booking, no auto-decline — the poster
  can accept several partners; each accepted musician gets the poster's contact.
- No completion, no reviews (nothing verifiable happened). Cancel = close.
- Board gets a Paid gigs / Practice toggle; post form toggles fee/date fields.
- D1 note: the deployed `gigs` table has NOT NULL/CHECK on fee and date, so this
  ships as a table rebuild migration (safe: copy-over; prod is empty today).

## Phase 2b — Core-loop polish (parallel, small PRs)

Geocoding on post + profile so radius search is real; display names and ratings
on applicant cards; public musician profile pages; gig-digest notifications once
email lands. (Tracked in TODO.md.)

## Phase 3 — Band formation (after gig liquidity)

`bands` (name, genres, home city, description, owner) + `band_seats`
(instrument, status open/filled). Seat applications reuse the application
pattern. Band page shows lineup, open seats, and members' JamWerk track records
(gigs played, ratings) — trust built from *paid* work is the differentiator no
band-finder app has. Gate: ship when a "bassist wanted (permanent)" seat in the
seed city would plausibly get 3+ applicants within a week.

## Phase 4 — Community / forum (deliberately last, and not a Reddit clone)

The friend's feedback is real: none of these apps has a living community, and a
living community is a genuine moat. But the reason none has one is the
cold-start trap, and we have first-hand proof: TrustAxis shipped a full forum
(categories, threads, replies, 4 languages) and got **zero threads ever** — it
now hides behind a feature flag because an empty forum reads as a dead product.
A general-purpose Reddit clone at JamWerk's size would repeat that.

So the forum arrives bottom-up, in three steps, each useful even with 10 users:

1. **Comment threads on objects that already exist** — a thread under each gig,
   practice listing, and band page. Content has a reason to exist (questions
   about the setlist, "is parking available", "can I bring my own amp"), so
   zero-content pages don't occur.
2. **City scene boards** — one board per seed city (not per topic). A city
   board aggregates that city's threads + a free-post stream. Only open a city
   when it has active listings; never show an empty board.
3. **Full forum with topic categories** — only if step 2 boards are active
   weekly. At that point it's growing an existing habit, not manufacturing one.

Moderation minimum before step 2: report button, poster-owner delete, simple
rate limit. (Reddit-ness — votes, nesting — only at step 3, if ever.)

## Mobile strategy (asked 2026-08: iOS/Android apps?)

Web-first, deliberately. Store apps are the most expensive commitment available
at POC stage: every iteration goes from minutes (deploy on push) to days
(review queues), plus release engineering and store accounts — all before
knowing what musicians actually use. The product is mobile-critical, though, so
the ladder is: (1) PWA install (DONE 2026-08-21) + web push next — 80% of the app experience from
the same codebase; (2) Capacitor wrap of the same code for real store presence
and native push once the seed city is liquid and push provably drives matches;
(3) native UI only if ever needed. The one thing store apps truly add earlier —
reliable iOS push — is also the first thing to validate cheaply via the PWA.

## Standing constraints

- One seed city until the gig board is liquid there; features never outrun
  liquidity (three empty tabs look deader than one).
- Hardening items in TODO.md (secrets, rate limiting, email) precede any
  public promotion.
