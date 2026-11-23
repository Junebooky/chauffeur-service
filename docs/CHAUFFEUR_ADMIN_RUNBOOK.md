# Chauffeur live operations

- Customer booking page submits to \`POST /api/reservations\`. Uses the shared Supabase project \`dating\`, isolated \`chauffeur\` schema.
- \`/admin\` is a **live reservation board**, not a sample demo. To honor the request for no page sign-in, it serves only masked references and non-personal operational progress through \`GET /api/admin-overview\`.
- \`/admin/live\` is the private, authenticated workspace for actual guest details, date-specific routes, supplier and driver assignment, reservation status, and payment records. \`GET/POST /api/admin\` enforces Supabase Auth + active \`chauffeur.staff_members\`.
- Available vehicle classes are requestable, never hard-assigned by license plate; operators handle sourcing after request.
- \`SUPABASE_URL\` and \`SUPABASE_SECRET_KEY\` (or legacy \`SUPABASE_SERVICE_ROLE_KEY\`) are server-only; \`VITE_SUPABASE_URL\` and \`VITE_SUPABASE_PUBLISHABLE_KEY\` are used for Supabase Auth on the private page.
- Local \`npm run dev\` uses the same Supabase-backed APIs when these server env vars are configured. When absent, local SQLite mode remains available for legacy tests; set \`CHAUFFEUR_USE_SQLITE=true\` to force offline mode.
- The newer \`sb_secret_...\` API key is **opaque**, so use it as \`apikey\`, not a JWT Bearer token. A legacy \`service_role\` JWT remains a server-only fallback. New env values on Vercel do not take effect until redeployment.
- \`GET /api/availability\` returns \`bookingSubmissionReady: true\` only when database credentials are configured.
- Run \`npm run check && npm test && npm run build\` and smoke-test \`GET /api/admin-overview\` in production.
- Real customer records are not inserted by migrations/tests.
