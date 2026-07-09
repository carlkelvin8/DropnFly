import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};

  if (type === "day" && date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    where.createdAt = { gte: dayStart, lte: dayEnd };
  } else if (type === "month" && month) {
    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
    where.createdAt = { gte: monthStart, lte: monthEnd };
  } else if (type === "range" && from && to) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    where.createdAt = { gte: fromDate, lte: toDate };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
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

  const escapeCsv = (val: string | number | null | undefined) => {
    const s = String(val ?? "");
    if (/^[=+\-@\t]/.test(s) || s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  };

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
      .reduce((sum, p) => sum + p.amount, 0);
    const balance = b.totalPrice - totalPaid;
    const rider = b.assignments[0]?.user || null;
    const qrScanned = ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"].includes(b.status);

    return [
      b.referenceNumber,
      b.customer.name,
      b.customer.email,
      b.pickupLocation,
      b.dropOffLocation,
      b.numberOfBags,
      b.totalPrice,
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
    ].map(escapeCsv).join(",");
  }).join("\n");

  const typeLabel = type === "all" ? "all" : `${type}`;
  return new NextResponse(header + "\n" + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bookings-${typeLabel}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
