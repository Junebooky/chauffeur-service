# Public no-sign-in operations preview

- \`/admin\` is intentionally accessible without passwords or Supabase Auth for UI/UX testing.
- The page displays **synthetic sample reservations**, and all edits are performed only in React component state. Nothing is read from or written to Supabase.
- \`/admin/live\` retains the original authenticated operations console for real reservations and payments.
- \`GET/POST /api/admin\` continues to require Supabase Auth and active staff membership. Do not remove these checks; the production application stores personal details and payments.
- \`POST /api/reservations\` is the separate public customer booking submission endpoint. It maintains validation and request throttling.
- Once passwordless live authentication is needed, use email OTP or magic-link sign-in for the authenticated route, **not** unguarded privileged endpoints.
