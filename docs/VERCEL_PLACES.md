# Production Place Search (Google Places API New)

The booking form uses two API endpoints:
- \`POST /api/places/search\`: autocomplete with Google Places API (New) if configured; otherwise verified Popular Locations from \`server/popular-places.json\`.
- \`POST /api/places/resolve\`: fetches canonical details for selected location. Curated results resolve with no Google calls. Google results carry a signed one-hour selection token which \`POST /api/reservations\` verifies. No serverless in-memory Map is needed.

**For full search**, add a server-only \`GOOGLE_MAPS_API_KEY\` (or \`GOOGLE_PLACES_API_KEY\`) to **Vercel → chauffeur-service → Settings → Environment Variables → Production**. Value must be your Google Cloud Platform key authorized for Places API (New); billing and quota must be enabled. Do not prefix this with \`VITE_\`. The key is not present in the repository or current Vercel environment, so the code cannot supply it.

The Google Cloud key needs application restrictions compatible with **server-side Vercel outbound requests**. Do not restrict it solely by the user's browser referrer; that would block server requests. Restrict it to the **Places API (New)** API; consider egress IP controls if you have fixed outbound IPs. New environment values take effect on the next Vercel deployment.

When the key is absent, curated popular locations remain fully usable; other addresses cannot be searched until the key is provided. Failed Google requests return a safe JSON error and show curated matches where available.

Local \`npm run dev\` with Supabase configured uses the same handlers as Vercel. In forced SQLite mode, the existing Express Places router remains active.

Verify \`POST /api/places/search\` with \`{"query":"","sessionToken":"12345678-1234-1234-1234-123456789012"}\` returns mode \`popular\` and six entries; verify \`resolve\` on one of their ids, and finally submit a customer reservation.
