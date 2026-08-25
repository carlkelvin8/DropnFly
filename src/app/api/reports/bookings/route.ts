import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasStaffRole } from "@/lib/staff-access";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN"])) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) {
      return NextResponse.json({ error: "Dates must use YYYY-MM-DD format" }, { status: 400 });
    }
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      location: { select: { name: true } },
      promoCode: { select: { code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = "Reference,Customer,Email,Phone,Status,Location,Bags,Price,Discount,Promo,Check In,Check Out,Created\n";
  const rows = bookings.map((b) =>
    [
      b.referenceNumber,
      escapeCsv(b.customer.name),
      b.customer.email,
      b.customer.phone,
      b.status,
      b.location?.name || "",
      b.numberOfBags,
      b.totalPrice,
      b.discount,
      b.promoCode?.code || "",
      b.checkIn.toISOString(),
      b.checkOut?.toISOString() || "",
      b.createdAt.toISOString(),
    ].join(",")
  ).join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function escapeCsv(val: string) {
  const safe = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  return `"${safe.replace(/"/g, '""')}"`;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
