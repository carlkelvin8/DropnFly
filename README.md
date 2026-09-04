# DropnFly

Luggage booking, storage, logistics, tracking, customer support, and payment management built with Next.js 16 and PostgreSQL.

## Requirements

- Node.js 20.19 or newer
- PostgreSQL (the provided configuration targets Supabase)

## Local setup

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Generate independent random values of at least 32 bytes for `NEXTAUTH_SECRET` and `CUSTOMER_JWT_SECRET`. Production startup intentionally fails without them.
3. Install dependencies with `npm install`.
4. Apply migrations with `npx prisma migrate deploy`.
5. Optionally seed development data with `npm run seed`.
6. Start the application with `npm run dev`.

## Verification

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` before deployment.

Public bookings receive a secure, HTTP-only, seven-day browser grant for the newly created booking. Customer and staff sessions can also authorize access. Booking references and internal database IDs are identifiers, not credentials.
