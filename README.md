# CHAUFFEUR — The art of arriving.

A complete English-language chauffeur website inspired by the supplied video: deep black and charcoal surfaces with champagne-gold accents, an autoplaying door-opening film, full-viewport chapters, and a working reservation request service.

## Run

Use Node.js 24 (the tested version is in `.node-version`). Node 22.13+ is required for the built-in SQLite API.

```sh
npm ci
npm run dev
```

Vite serves the site on port **5173** and proxies `/api` to the Express service on **3001**. No external accounts, credentials, paid APIs, or database installation are needed. Vite provides frontend hot reload; restart `npm run dev` after changing the API or shared catalog.

Production:

```sh
npm run build
npm start
```

The production server serves both the site and API on port **3001**. Optional environment settings are listed in `.env.example`; copy it to `.env` to override defaults. `DATABASE_PATH` selects the SQLite file. Keep this file on persistent storage when deploying. Changing the API port during development also requires updating the Vite proxy target.

## Experience

- **Welcome:** a locally hosted 2.1-second MP4, encoded from the supplied door-opening sequence. It plays once, muted and inline, then holds the open-door scene. The hero occupies one viewport and never locks scrolling for loading or playback. If autoplay is blocked, a play button is available; reduced motion or a media error uses the still image. The original browser chrome and embedded page copy are excluded from the artwork.
- **The collection:** exterior, cabin, and cockpit views extracted from the supplied reference; vehicle details and amenities.
- **Our services:** airport transfer, four-hour service, and full-day service. Choosing a service carries it into the reservation form.
- **Your journey:** date calendar, pickup time and route, two vehicle classes, optional extras, contact details, and a live quote.

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

The nine API tests cover persistence across restarts, server-calculated pricing, overlapping and concurrent requests, safe retries, validation, rate limiting, and privacy of stored contact details.

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
src/catalog.json            Shared service, vehicle and option prices
src/styles.css              Responsive visual design
server/app.mjs              Reservation validation, SQLite and API
server/index.mjs            Development/production server entry
tests/api.test.mjs          Isolated API tests
public/media/               Optimised assets from the supplied video
public/fonts/               Self-hosted fonts and their OFL licenses
```

Visual assets are derived from the user-supplied `gemini_generated_video_3abd552a (1).mp4`. The original recording is not needed at runtime. Cormorant Garamond and Manrope are distributed under the SIL Open Font License; license notices are included in `public/fonts/`. Icons are from Lucide.
