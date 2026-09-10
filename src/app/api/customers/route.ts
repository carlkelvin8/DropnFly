import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validations";
import { hasStaffRole } from "@/lib/staff-access";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
    },
    omit: { password: true },
  });

  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const normalizedEmail = String(body.email).trim().toLowerCase();
    const trimmedName = String(body.name).trim();
    const trimmedPhone = String(body.phone).trim();
    const countryOfOrigin = body.countryOfOrigin || null;
    const cityOfOrigin = body.cityOfOrigin || null;

    // Senior: a single email is an identity, not a one-time booking.
    // Walk-ins (and returnees online) must be able to book multiple times
    // with the same Gmail. The `reuseExisting` flag from the walk-in UI
    // explicitly opts into reuse, but even without it we treat the email as
    // idempotent — we upsert and refresh the profile so staff don't get
    // blocked with "Customer already exists" on return visits.
    // Keep 409 only for the standalone "Add Customer" page when caller
    // explicitly wants strict uniqueness; walk-in bookings always reuse.
    const isWalkInReuse = body.reuseExisting === true;

    if (isWalkInReuse) {
      // Walk-in: same email means same Customer identity, but walk-in staff
      // input is authoritative for this transaction — the name/phone the staff
      // typed for "Malunggay Pandesal" must be what the booking and confirmation
      // email show, not a stale "Kristina Divivar" from a previous night's test.
      // We refresh the profile so the new booking's customer relation reflects
      // exactly what the admin typed. Previous bookings share the same Customer
      // row and will also show the refreshed name — acceptable because email is
      // identity; for truly distinct persons, staff should use distinct emails.
      const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        // Only update if something actually changed to avoid unnecessary writes
        const needsUpdate =
          trimmedName !== existing.name ||
          trimmedPhone !== existing.phone ||
          (countryOfOrigin || null) !== (existing.countryOfOrigin || null) ||
          (cityOfOrigin || null) !== (existing.cityOfOrigin || null);
        if (needsUpdate) {
          const updated = await prisma.customer.update({
            where: { email: normalizedEmail },
            data: {
              name: trimmedName,
              phone: trimmedPhone,
              countryOfOrigin,
              cityOfOrigin,
            },
            omit: { password: true },
          });
          return NextResponse.json(updated);
        }
        const { password, ...safe } = existing as unknown as Record<string, unknown>;
        void password;
        return NextResponse.json(safe);
      }
      const customer = await prisma.customer.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          phone: trimmedPhone,
          countryOfOrigin,
          cityOfOrigin,
        },
        omit: { password: true },
      });
      return NextResponse.json(customer);
    }

    // Non-walk-in customer creation (e.g. Customers → New Customer)
    // Preserve strict uniqueness for that UI, but return the existing
    // customer as 200 so the UI can offer "reuse" instead of a dead-end 409.
    // Senior-level: don't block staff from serving a returnee.
    const existing = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // For dashboard Customers/new, signal duplicate but allow reuse.
      // We keep 409 for backwards-compat but include the existing id so
      // the UI can recover without a second round-trip if it wants to.
      return NextResponse.json(
        { error: "Customer with this email already exists", customerId: existing.id, reuseExisting: true },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        phone: trimmedPhone,
        countryOfOrigin,
        cityOfOrigin,
      },
      omit: { password: true },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
