# Admin AI Assistant

Page: `/dashboard/assistant`, accessible through the admin sidebar. API: `POST /api/admin/assistant`. Both require ADMIN role; staff, employees, and customers cannot use the endpoint. Existing customer chatbot remains unchanged.

Set `GEMINI_API_KEY` on the server. Optional `GEMINI_ADMIN_MODEL` defaults to `gemini-2.5-flash`. Restart development server after environment changes; update hosting environment for deployment. Never use a NEXT_PUBLIC variable for the API key.

The assistant answers workflow questions, drafts messages, and interprets optionally supplied all-time booking status counts. Snapshot sharing is off by default and clearly disclosed in the UI. Only status counts and fetch timestamp are queried for that context. No customer names, contacts, GPS positions, settings secrets, or individual bookings are sent automatically. User-entered conversation is sent to Google, so admins must avoid sensitive information.

No function calling, record mutations, or arbitrary database query execution. The model is instructed to distinguish facts from suggestions and cannot actually execute actions. Prompt instructions are not a guarantee of answer accuracy; administrators must verify answers.

Recent conversation (12 messages) provides context; page state is not saved to database or browser storage. New conversation clears local state. Errors retain the unsent question. Requests are per-admin rate-limited, validated, bounded, and time-limited. Provider errors are returned without logging credentials or conversation text.

Acceptance checks: valid key -> ask workflow question -> follow up -> optionally include aggregate snapshot -> reset conversation. Verify non-admin requests return 403, unauthenticated requests 401, missing key 503, malformed requests 400, quota failure 429, and timeouts/provider failures display errors. Real provider responses and authenticated browser behavior still require end-to-end verification.
