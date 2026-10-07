import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasStaffRole } from "@/lib/staff-access";
import { escapeCsvCell } from "@/lib/csv";
import { manilaDayRange, manilaDayStart, manilaMonthRange } from "@/lib/manila-time";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};

  // Day and month boundaries are Manila calendar days, not the server's (UTC) clock.
  const validDay = (value: string | null): value is string => Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value as string) && !isNaN(new Date(`${value}T00:00:00+08:00`).getTime());
  if (type === "day" && validDay(date)) {
    const { start, end } = manilaDayRange(manilaDayStart(date));
    where.createdAt = { gte: start, lt: end };
  } else if (type === "month" && month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    const { start, end } = manilaMonthRange(year, mon);
    where.createdAt = { gte: start, lt: end };
  } else if (type === "range" && validDay(from) && validDay(to)) {
    where.createdAt = { gte: manilaDayStart(from), lt: manilaDayRange(manilaDayStart(to)).end };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    // Large base64 fields the CSV never uses.
    omit: { qrCode: true, luggagePhotos: true },
    include: {
      customer: { select: { name: true, email: true } },
      assignments: {
        include: { user: { select: { name: true, email: true, profilePic: true, vehicleType: true, plateNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      payments: { select: { amount: true, status: true, method: true, paidAt: true } },
    },
  });

  const header = [
    "Reference",
    "Customer Name",
    "Customer Email",
    "Pickup Location",
    "Drop-off Location",
    "Number of Bags",
    "Total Price",
    "Total Paid",
    "Balance",
    "Payment Status",
    "Status",
    "QR Scanned",
    "Assigned Rider",
    "Rider Vehicle",
    "Rider Plate No.",
    "Check In",
    "Check Out",
    "Created At",
  ].join(",");

  const rows = bookings.map((b) => {
    const totalPaid = b.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Number(b.totalPrice) - totalPaid;
    const rider = b.assignments[0]?.user || null;
    const qrScanned = ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"].includes(b.status);

    return [
      b.referenceNumber,
      b.customer.name,
      b.customer.email,
      b.pickupLocation,
      b.dropOffLocation,
      b.numberOfBags,
      Number(b.totalPrice),
      totalPaid,
      balance,
      balance === 0 ? "Full" : totalPaid > 0 ? "DP" : "Unpaid",
      b.status,
      qrScanned ? "Yes" : "No",
      rider?.name ?? "",
      rider?.vehicleType ?? "",
      rider?.plateNumber ?? "",
      b.checkIn ? b.checkIn.toISOString() : "",
      b.checkOut ? b.checkOut.toISOString() : "",
      b.createdAt.toISOString(),
    ].map(escapeCsvCell).join(",");
  }).join("\n");

  const typeLabel = type === "all" ? "all" : `${type}`;
  return new NextResponse(header + "\n" + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bookings-${typeLabel}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
