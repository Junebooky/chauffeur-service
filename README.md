# CHAUFFEUR — The art of arriving.

A complete English-language chauffeur website inspired by the supplied video: deep black and charcoal surfaces with champagne-gold accents, an autoplaying door-opening film, full-viewport chapters, and a working reservation request service.

## Project status and release readiness

The repository currently implements airport transfer, four-hour hourly service and full-day service with **illustrative** rates. The planned standalone long-distance quote engine, operator approvals/driver assignment, scroll-controlled hero, expense evidence and customer settlement reports are **not yet implemented**.

See [STATUS_BOARD.md](STATUS_BOARD.md) for the shared milestone pipeline and [the 2026-11-01 repository audit](docs/REPO_AUDIT_2026-11-01.md) for verified scope versus planned features. The site's booking confirmation is a **pending request only**; do not treat a request as dispatched, paid or confirmed.

## Run

Use Node.js 24 (the tested version is in `.node-version`). Node 22.13+ is required for the built-in SQLite API.

```sh
npm ci
npm run dev
```

Vite serves the site on port **5173** and proxies `/api` to the Express service on **3001**. The basic site and its local popular-location directory need no credentials or separate database installation. Full live address search requires a Google Places API key (see below). Vite provides frontend hot reload; restart `npm run dev` after changing the API or shared catalog.

Production:

```sh
npm run build
npm start
```

The production server serves both the site and API on port **3001**. Optional environment settings are listed in `.env.example`; copy it to `.env` or `.env.local` to override defaults. `DATABASE_PATH` selects the SQLite file. Keep this file on persistent storage when deploying. Changing the API port during development also requires updating the Vite proxy target.

## Experience

- **Welcome:** a locally hosted 2.1-second MP4, encoded from the supplied door-opening sequence. It plays once, muted and inline, then holds the open-door scene. The hero occupies one viewport and never locks scrolling for loading or playback. **The film is currently autoplayed, not frame-scrubbed by scroll position.** If autoplay is blocked, a play button is available; reduced motion or a media error uses the still image. The original browser chrome and embedded page copy are excluded from the artwork.
- **The collection:** exterior, cabin, and cockpit views extracted from the supplied reference; vehicle details and amenities.
- **Our services:** airport transfer, four-hour service, and full-day service. Choosing a service carries it into the reservation form.
- **Your journey:** date calendar, pickup time and route, a convex-style interactive vehicle carousel, multilingual address selection, optional extras, contact details, and a live quote.

Every chapter, including the hero, occupies one viewport. The first vertical wheel delta advances to the adjacent chapter, including small continuous trackpad deltas. Subsequent momentum from that gesture is grouped until input stops for 180ms; there is no minimum delta, input-gap requirement, video lock, or animation lock. CSS scroll snap aligns native touch and scrollbar scrolling. Keyboard navigation is supported. Forms and compact layouts scroll natively, and scrolling can chain out of a panel at its boundary. At short desktop heights, chapter content can scroll within its viewport to remain reachable.

The mobile navigation, section rail, and direct CTAs provide alternatives to scrolling. Reduced-motion preferences replace the film with a still image and use immediate chapter navigation. Native dialogs provide focus trapping and Escape handling. Fonts and media are self-hosted.

## What reservations do

`POST /api/reservations` validates the request, calculates the price from the server-side catalog, prevents overlapping requests for the same vehicle class in a SQLite transaction, and persists a **pending** request. An idempotency key makes retrying the same submission safe. Dates require at least two hours' notice and cannot be more than a year ahead. Times use **Asia/Seoul (UTC+9)**.

Successful submissions display a reference and offer a downloadable **tentative** calendar event. No payment is taken. There is no public endpoint that lists stored personal details. Request rate limiting is local to the server process.

**This is not a connected commercial booking operation.** Operator delivery, email/SMS, payment, driver assignment, fleet-provider availability, cancellation, and booking confirmation are not connected. The UI states this before and after submission. Availability reflects requests in this database and assumes one unit per vehicle class. Prices are illustrative; vehicle images and models are representative. Use sample contact details while evaluating.

Before live operations, connect an operator workflow and notification provider, establish actual inventory and cancellation/retention policies, and deploy the database on persistent storage. Do not expose the local database file through a static host.

### Endpoints

| Endpoint                                                          | Purpose                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/health`                                                 | Verify that the API and SQLite database respond                   |
| `GET /api/availability?date=YYYY-MM-DD&time=HH:MM&service=hourly` | Check each vehicle class against local pending/confirmed requests |
| `POST /api/reservations`                                          | Save a pending request; requires an `Idempotency-Key` header      |

The catalog, option prices, and vehicle surcharge live in `src/catalog.json`; both the frontend and API use this file. The database is created at `.data/reservations.sqlite` and is ignored by Git. Do not commit personal data or `.env` files.

## Validation

```sh
npm run check
npm test
npm run build
```

The API and address-service tests cover persistence across restarts, server-calculated pricing, overlapping and concurrent requests, safe retries, validation, rate limiting, canonical route coordinates, multilingual popular-place matching, Google REST request contracts using an injected test transport, expired/forged place selections, and privacy of stored contact details. Live Google calls require your key and are not validated by the fixture tests.

Production browser checks use Python Playwright and Chromium:

```sh
# In a Python environment with Playwright available:
python3 scripts/browser-test.py
```

The script uses a temporary database, starts/stops its own production server on port 4183, and checks real video playback through its end, wheel navigation across all chapters, small continuous trackpad deltas, dark surface colours, keyboard navigation, complete desktop and mobile submissions, calendar download, reduced motion, dialogs, and layout at 1440, 1366, 1024, 768, 390, and 360px widths. It uses system Chromium when available; otherwise install the Playwright browser with `python3 -m playwright install chromium`. Override `CHROMIUM_PATH` if needed. Screenshots are written to ignored `test-results/`.

`scripts/visual-check.py` is an optional screenshot helper for an already running development server.

## Structure

```text
src/App.tsx                 Navigation, collection, services, dialogs
src/Hero.tsx                One-shot welcome film and playback fallbacks
src/useJourneyScroll.ts     Reliable wheel/keyboard navigation and passive section tracking
src/Booking.tsx             Calendar and three-step request flow
src/AddressSearch.tsx        Accessible address autocomplete with a portalled result list
src/VehicleCarousel.tsx      Perspective vehicle selector with keyboard/touch support
src/catalog.json            Shared service, vehicle and option prices
src/styles.css              Responsive visual design
server/app.mjs              Reservation validation, SQLite and API
server/places.mjs           Server-only Google Places adapter and resolved-location validation
server/popular-places.json  Explicitly labelled multilingual popular-location directory
server/index.mjs            Development/production server entry
tests/api.test.mjs          Isolated API tests
public/media/               Optimised assets from the supplied video
public/fonts/               Self-hosted fonts and their OFL licenses
```

Visual assets are derived from the user-supplied `gemini_generated_video_3abd552a (1).mp4`. The original recording is not needed at runtime. Cormorant Garamond and Manrope are distributed under the SIL Open Font License; license notices are included in `public/fonts/`. Icons are from Lucide.

## Multilingual address search

The UI remains English, while the address inputs accept Unicode queries, including Korean, English, Chinese, and Japanese. Search waits until IME composition ends, debounces requests by 250ms, aborts stale requests, and supports keyboard selection. Selecting a suggestion resolves its full address and building-level latitude/longitude. Merely typing text is not sufficient; editing a selected location clears that selection. The server independently validates the chosen location, ignores client-supplied coordinates, and stores canonical route metadata with the reservation. Pickup and destination must differ. Exact entrances/meeting points still need confirmation.

Without a key, the UI explicitly says **Popular locations only**. This directory includes Incheon T1/T2, Gimpo International Terminal, Seoul Station, Four Seasons, Grand Hyatt, Lotte Hotel Seoul, and COEX. Aliases include English, Korean, Chinese, and Japanese names. These are building-level reference points, not an exhaustive geocoder or terminal-specific pickup-bay instructions.

To enable full live address search:

1. In Google Cloud, enable billing and **Places API (New)**. Create a server API key restricted to that API. Configure provider quotas appropriate for your operation.
2. Locally, copy `.env.example` to `.env` and securely set `GOOGLE_MAPS_API_KEY`. In this managed cloud environment, enter it in the `GOOGLE_MAPS_API_KEY` secret requirement in environment settings. The secret is restricted to `places.googleapis.com`. Do not use a `VITE_` variable: the key must never reach the frontend or Git.
3. Restart the API server. Queries of two or more characters use Google Places Autocomplete (New), bias toward Seoul, and restrict results to South Korea. Query text stays in its original language; result labels are requested in English. Select an actual result to resolve it through Place Details (New).
4. Verify real multilingual searches and a booking with your enabled key. The local tests exercise the provider contract using fixtures; they do not establish that your Google billing, key permissions, network policy, or real-world search results work.

The frontend sends search/resolve requests to this server, which calls Google through the inherited HTTPS proxy using Undici's `EnvHttpProxyAgent` and existing TLS trust. It sends no contact details to Google. Search requests are rate limited and time out, and upstream diagnostic bodies/keys are never returned to the browser. Google search sessions end on selection; resolved Google selections expire after an hour or API restart, at which point the user must select again. Provider failure is shown honestly rather than silently treating free text as a confirmed place.

`POST /api/places/search` takes `{ query, sessionToken }`; `POST /api/places/resolve` takes `{ id, sessionToken }`. Reservation requests now require `pickupPlace` and `destinationPlace`: either a known curated ID or a server-resolved Google ID plus its `selectionToken`. The server supplies the authoritative coordinates. Google attribution is displayed with live results; its official image is served from `maps.gstatic.com`. Google Maps terms/privacy links are available in the site's privacy notice. Follow the provider's current attribution, content-retention, and licensing terms when connecting live operations; place IDs can be retained for later re-resolution.

Vehicle selection artwork in `public/media/fleet/` is generated representative artwork (one PNG per listed vehicle). The carousel shows the four representative vehicle classes listed in `src/catalog.json`; repeated side previews are a looping visual treatment, not additional physical vehicles or confirmed stock. Arrow controls, direct selection, pagination, horizontal touch swipes, and left/right keyboard keys all update the selected vehicle and quote. Focused form inputs use only their existing border, retaining a visible keyboard focus indication without an extra outer outline.
