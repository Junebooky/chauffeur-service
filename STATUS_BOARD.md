# Chauffeur Service — Shared Live Status Board

> Maintained by A01 · Reference: `Junebooky/chauffeur-service` · Updated 2026-11-01 KST.
>
> States: `[ ]` planned · `[~]` in progress · `[x]` uploaded/verified at stated evidence level · `[!]` blocked.
> **No task may be marked done without a real linked artifact.** Review branch is not a production release. Review changes in [PR #1](https://github.com/Junebooky/chauffeur-service/pull/1).

## M0 — Repository synchronization and safety fixes (P1)

- [x] **[A01 / STATIC_REVIEW]** Reviewed project files, recent 4 commits, default branch and open PR status. Baseline: [main at 56b4cee](https://github.com/Junebooky/chauffeur-service/commit/56b4cee293a674fc82a2112f604988395c3f1b72). Findings: [audit](docs/REPO_AUDIT_2026-11-01.md).
- [x] **[A01 / PATCH_UPLOADED]** Corrected missing hero fallback asset and booking availability uncertainty on review branch. See [Hero](src/Hero.tsx), [Booking](src/Booking.tsx), [regression guard](tests/ui-contract.test.mjs).
- [x] **[CI / AUTOMATED]** Node 24 quality pipeline (install, TypeScript, tests, build) passed on [push run 41314143153](https://github.com/Junebooky/chauffeur-service/actions/runs/41314143153) at commit `33a284b`. This is not independent browser QA.
- [ ] **[A04 / NOT_RUN]** Run production browser E2E, scroll/video QA, mobile widths and reservation-path QA on the final review commit. No E2E PASS claimed.
- [ ] **[A01 + owner / APPROVAL]** Review changes and approve final merge to `main`.

## M1 — Three-service production-ready booking (P0)

- [ ] **[A06]** Approve service types (hourly, airport, long-distance), distance/zone/time prices, inventory and driver contracts.
- [ ] **[A03]** Design actual three-service booking and quote flow; English UI.
- [ ] **[A02]** Implement quote, availability and admin confirmation end-to-end.
- [ ] **[A04]** Independent double-booking, pricing, failure and mobile checks.

## M2 — Evidence-based operating and settlement reports (P0 for proposed trust proposition)

- [ ] **[A06]** Define privacy, retention, proof confidence and billable-cost rules.
- [ ] **[A03]** Design English `Our Standard` and demo Journey Report UI.
- [ ] **[A02]** Implement driver evidence capture, expense review and settlement reports.
- [ ] **[A04]** Verify permissions, originals, upload integrity and expense claims.

## M3 — Scroll-reactive hero (P1)

- [ ] **[A03]** Lock the cinematic door-opening storyboard and media source.
- [ ] **[A02]** Implement true scroll-scrub or Canvas frames with mobile fallback.
- [ ] **[A04]** Verify reverse scrolling, iOS, reduced motion and performance.

## Decisions required

- [ ] **[Owner]** Approve production database/framework architecture before a major migration.
- [ ] **[Owner]** Approve all actual prices, operating region and exclusions.
- [ ] **[Owner]** Approve public release after integration and QA evidence.

## Post-launch improvements (P2/P3)

- [ ] Vehicle inventory automation, 3D hero evaluation and UX polish once MVP is operational.
