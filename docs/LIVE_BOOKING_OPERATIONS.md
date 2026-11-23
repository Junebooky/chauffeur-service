# Live booking and operations flow

This repo uses **Supabase \`dating\` → schema \`chauffeur\`** for persistent production bookings.

1. Customer selects journey dates, routes, and vehicle classes on the website.
2. \`GET /api/availability\` marks every vehicle **requestable**, not assigned.
3. \`POST /api/reservations\` validates the customer's data, throttles repeat requests, and calls \`chauffeur.create_booking_request_v1\` (atomic, idempotent).
4. Supabase persists \`reservations\`, \`reservation_days\`, and \`notification_outbox\`; operator email is attempted after commit.
5. \`GET /api/admin-overview\` supplies a **live, privacy-redacted operational view** to \`/admin\`. Polls about every 30 seconds. No synthetic records are generated.
6. Authenticated operators can use \`/admin/live\` and \`GET/POST /api/admin\` for customer details, assignment, status changes, and payment records.

### Local development

Vite's \`/api\` proxy forwards to Express port 3001. With \`SUPABASE_URL\` and \`SUPABASE_SECRET_KEY\` or legacy \`SUPABASE_SERVICE_ROLE_KEY\` present in \`.env.local\`, Express mounts the same persisted Supabase booking handlers as Vercel. Offline SQLite is still supported when these variables are absent or \`CHAUFFEUR_USE_SQLITE=true\`.

The modern \`sb_secret_...\` key goes in \`SUPABASE_SECRET_KEY\` (server only); \`server/chauffeur-supabase.mjs\` sends it as \`apikey\` without misrepresenting it as a JWT Bearer token. The legacy service_role JWT remains a fallback. In Vercel, new env values require a new deployment to take effect.

### Security

\`/admin\` contains only masked identifiers and operational states. It **never** returns customer contact details, exact routes, payment amounts, reservation UUIDs or full references. The private \`/admin/live\` and privileged \`/api/admin\` still validate Supabase Auth sessions against \`chauffeur.staff_members\` on every request. Do **not** remove server-side authorization checks.

The public overview shows the most recent 100 requests, not all-time analytics.

### Validation

Run \`npm ci && npm run check && npm test && npm run build\`.
SQL function tests should be run inside an explicit transaction with \`ROLLBACK\` to avoid fake production data. Real customer data is never seeded by these tests.
