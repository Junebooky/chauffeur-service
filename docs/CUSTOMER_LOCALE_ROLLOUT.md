# Customer localization rollout
First increment: locale routing, in-place switch, navigation, Hero, Fleet and Pricing copy, contact and privacy. The existing booking screen, catalog IDs, availability and payment behavior are untouched in this increment. Phase 2: localize booking and search, preserve reservation state and API identifiers, then email/PDF and per-language SEO. Validate desktop and mobile before production integration. The language switch reuses the existing desktop slot and adds a mobile menu item because the desktop slot is hidden on narrow screens.

Second increment: booking display copy, calendar labels/date display, shared input labels and visible search help, vehicle descriptions and form errors. No API payload or price calculation changes. Live Google result language, customer email and exports, metadata/prerender, and visual QA remain separate.

Third increment: restore language switch at 1001–1150px, use selected language for live place searches, persist preferredLocale in existing request_payload (no new column), build per-language HTML metadata and reciprocal sitemap. Full content prerender and deployed indexing are not yet verified.

Fourth increment: customer email and confirmation PDF use the stored preferredLocale, while operator notices and historical snapshots default to English. Client PDF/PNG uses current display language. Apply docs/sql/customer-locale-v1.sql separately after schema verification. No live mail or migration executed.
