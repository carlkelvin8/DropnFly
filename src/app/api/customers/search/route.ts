import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasStaffRole } from "@/lib/staff-access";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const key = requestKey(req);
  const { allowed, retryAfter } = await rateLimit(`customer-search:${key}`, 20, 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF", "EMPLOYEE"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const query = (q || "").trim();
  // Data privacy: customer records are never listed without a search term.
  if (query.length < 2) return NextResponse.json([]);

  // Bookings carry their own passenger name/email/phone (the shared customer row keeps only the
  // first one), so match those and the reference number too.
  const where = {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query, mode: "insensitive" as const } },
          {
            bookings: {
              some: {
                OR: [
                  { referenceNumber: { contains: query, mode: "insensitive" as const } },
                  { customerNameSnapshot: { contains: query, mode: "insensitive" as const } },
                  { customerEmailSnapshot: { contains: query, mode: "insensitive" as const } },
                  { customerPhoneSnapshot: { contains: query, mode: "insensitive" as const } },
                ],
              },
            },
          },
        ],
      };

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { bookings: true } },
      bookings: { select: { createdAt: true, customerNameSnapshot: true }, orderBy: { createdAt: "desc" }, take: 5 },
    },
    take: 20,
  });
  customers.sort((a, b) => (b.bookings[0]?.createdAt?.getTime() ?? 0) - (a.bookings[0]?.createdAt?.getTime() ?? 0));

  return NextResponse.json(
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      totalBookings: c._count.bookings,
      createdAt: c.createdAt,
      lastBookingAt: c.bookings[0]?.createdAt ?? null,
      // Other names used on this customer's bookings (e.g. booking made for a companion).
      bookingNames: [...new Set(c.bookings.map((b) => b.customerNameSnapshot).filter((n): n is string => Boolean(n) && n !== c.name))],
    }))
  );
}
