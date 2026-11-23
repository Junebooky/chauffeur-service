# Chauffeur Operations Console

- Admin route: `/admin` on the existing Vite site (email and password via Supabase Auth).
- Project: Supabase `dating` (`rvaowhriekibxtcpyalu`), dedicated `chauffeur` schema.
- Existing verified operator email account is registered as `owner` in `chauffeur.staff_members`.
- Vercel Production contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and **server-only** `SUPABASE_SERVICE_ROLE_KEY`.
- Public submission: `POST /api/reservations` -> server-side validation -> `chauffeur.create_booking_request_v1` atomic RPC -> outbox/email.
- Operations: `GET/POST /api/admin` checks Supabase Auth token and active Chauffeur staff membership on every request.
- Inventory policy: vehicles are requested by **class**, never hard-reserved by license plate. Operator confirms supply later.
- Admin screens: booking list, status, multi-day itineraries, suppliers, drivers, assignments, manual payment records.
- Password login avoids changing project-global Auth redirect URLs used by other services.
- Custom schema Data API config preserves `public, cockpit, crewlink, planner` and adds `chauffeur`; anon cannot read the tables.
- Production secret is currently the **legacy** service role key previously supplied by the user; create a per-service `sb_secret_` key in Supabase API Keys, swap the Vercel server env, then rotate old keys only after checking all shared apps.
- After code changes, verify `npm ci && npm run check && npm test && npm run build`, then smoke-test a real `/api/availability` request, a test booking, and admin login. No real test customer booking is seeded by migration.
