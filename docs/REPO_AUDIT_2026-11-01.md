# Chauffeur Service — repository audit and implementation gaps

_Audit date: 2026-11-01 KST · Based on main at `56b4cee293a674fc82a2112f604988395c3f1b72`._

## Verified repository implementation

- **Runtime:** Vite + React/TypeScript frontend, Express server, Node built-in SQLite. **Not** Next.js or Supabase.
- **Landing page:** English copy; dark/charcoal/gold design; video hero; fleet, services, reservation sections.
- **Hero:** Plays an approximately 2.1s film automatically; it is **not** controlled by scroll progress. Native snap/chapter navigation is implemented.
- **Fleet:** Four catalogue options: Kia Carnival, Carnival Hi-Limousine, Staria Lounge Limousine and Mercedes Sprinter 519. These represent bookable classes, not independently scheduled physical VINs.
- **Services actually implemented:** `airport` (3 h), `hourly` (4 h), `day` (9 h), with fixed illustrative rates. **No dedicated point-to-point/long-distance distance engine.**
- **Availability:** Server checks overlapping `pending`/`confirmed` requests for one inventory unit per vehicle ID. No per-vehicle fleet assignment, driver schedule, maintenance block or deadhead/turnaround buffer.
- **Booking:** Idempotent POST, server-computed catalogue pricing, SQLite transaction, KST date validation and pending request storage.
- **Addresses:** Curated South Korea locations with optional Google Places API for live multilingual selection, if correctly configured.
- **USD:** An approximate conversion display backed by a cached exchange-rate request with a static fallback; authoritative charge remains in KRW.
- **Operations:** No operator inbox, live SMS/email delivery, confirmation API, payment integration or customer account.
- **Expense evidence:** No receipt upload, GPS/odometer evidence, expense verification, settlement or customer-facing journey report.

Do not portray any of the missing features as launched or independently verified.

## Changes in this review branch

1. Hero's fallback/poster now points to existing `/media/exterior.webp`; the former `/media/hero/000.webp` is absent from the repository.
2. Reservation UI only enables submission when availability is explicitly `true` (not merely unknown), and no longer labels a pending request as “instant”.
3. Regression guards for the critical hero asset and booking availability UI contract.
4. Shared project status board and a CI workflow proposed for automated verification.

## Next major work packages (not implemented in this review)

### M1 — Production-grade three-service quote and booking engine (P0)

- Define `hourly`, `airport`, `long_distance` as separate service types, with full-day as an **hourly package**, not a substitute for long-distance transfer.
- Define time rules, variable duration, mileage threshold, waiting time, airports/zone fares, distance and toll treatment, cancellation and taxes. Require business approval of price policy.
- Calculate **all** quotes server-side with a quote ID, expiry, service/version snapshot and manual-quote fallback where route pricing is unavailable.
- Model `vehicle_classes`, actual `vehicles`, `drivers`, `bookings`, `vehicle_time_blocks`, `driver_time_blocks`. Re-check availability and resource constraints atomically at confirmation.
- Add separate authenticated operator approval workflow; request submission must not imply a confirmed booking.

### M2 — Trust & verifiable expense settlement (P0 for planned trust proposition)

- Driver/mobile evidence workflow: capture start/end odometer, receipts and applicable timestamps; restrict file access.
- Preserve original evidence, content hash, contributor, upload time and verification/audit events.
- Associate toll/card official records as independent evidence where obtainable; do not treat a photo or metadata as independently authenticated.
- Record `expenses`, `evidence`, `verifications` and `settlement_reports`, separating **incurred costs** from **contractually billable costs**.
- Offer an itemized sample report labeled **DEMO** until real verified workflow launches.
- Define retention, privacy and VIP location-data access policy before public use.

### M3 — Scroll-reactive cinematic hero (P1)

- Current hero is autoplay video, not a scroll scrub. Prototype true scroll-driven video scrubbing and image-sequence Canvas as alternatives.
- Ensure reverse-scroll, initial/last frames, accessible reduced-motion fallback, performance-limited mobile mode and proper text overlays.
- Validate actual generated/captured footage quality before claiming a 3D implementation.

### M4 — Release readiness (P0)

- Connect a real operator workflow, notifications, cancellation and customer contact channels.
- Define inventory truth, privacy/compliance and payment workflow (only if charged).
- Verify live Places key, server persistence, idempotency, concurrency, mobile rendering and actual browser behavior.
- Run CI and independent QA after implementing each complete end-to-end milestone; do not infer pass from source review.

## Decision records pending owner approval

1. Remain on the existing Vite/Express/SQLite stack for the prototype **or** migrate to Next.js/Supabase/PostgreSQL for production. Do not silently replace the deployed architecture.
2. Confirm regional scope, pricing currency, service zones and billable distance rules.
3. Confirm manual approval versus payment-first booking and time-window/availability semantics.
4. Confirm evidence-retention/visibility policy for VIP journeys.

## Evidence level

This review is a **static repository audit**. There were no linked GitHub Actions runs on the inspected head. Changes pushed to the review branch require CI execution and/or independent E2E QA before merging or announcing production readiness.
