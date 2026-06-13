import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { customer: true, location: true, payments: true, promoCode: true },
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
  return `"${val.replace(/"/g, '""')}"`;
}
