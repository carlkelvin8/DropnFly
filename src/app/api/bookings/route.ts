import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import type { BookingStatus } from "@/generated/prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const include = searchParams.get("include");
  const statusParam = searchParams.get("status");
  const paymentFilter = searchParams.get("payment");
  const riderId = searchParams.get("riderId");

  const statusGroups: Record<string, string[]> = {
    upcoming: ["PENDING"],
    ready: ["CONFIRMED"],
    received: ["RECEIVED"],
    "in-storage": ["IN_STORAGE"],
    "out-for-delivery": ["OUT_FOR_DELIVERY"],
    completed: ["DELIVERED"],
    ongoing: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"],
    delivered: ["DELIVERED"],
    cancelled: ["CANCELLED"],
    "no-show": ["NO_SHOW"],
  };

  let statusFilter: string[] | undefined;
  if (statusParam) {
    const key = statusParam.toLowerCase().replace(/\s+/g, "-");
    statusFilter = statusGroups[key] || [statusParam.toUpperCase()];
  }

  const where: Record<string, unknown> = {};
  if (statusFilter) {
    where.status = { in: statusFilter };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      location: { select: { name: true, city: true } },
      user: { select: { name: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, email: true, profilePic: true, vehicleType: true, plateNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      payments: { select: { amount: true, status: true, method: true, paidAt: true } },
      ...(include === "chat" ? {
        _count: { select: { chatMessages: true } },
      } : {}),
    },
  });

  const mapped = bookings.map((b) => {
    const totalPaid = b.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);

    let paymentStatus: "full" | "dp" | "unpaid" = "unpaid";
    if (totalPaid >= b.totalPrice && b.totalPrice > 0) paymentStatus = "full";
    else if (totalPaid > 0) paymentStatus = "dp";

    const qrScanned = ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"].includes(b.status);
    const rider = b.assignments[0]?.user || null;

    return {
      id: b.id,
      referenceNumber: b.referenceNumber,
      customer: b.customer,
      pickupLocation: b.pickupLocation,
      dropOffLocation: b.dropOffLocation,
      numberOfBags: b.numberOfBags,
      totalPrice: b.totalPrice,
      status: b.status,
      createdAt: b.createdAt,
      qrScanned,
      paymentStatus,
      totalPaid,
      rider,
    };
  });

  let filtered = mapped;
  if (paymentFilter === "full") filtered = filtered.filter((b) => b.paymentStatus === "full");
  else if (paymentFilter === "dp") filtered = filtered.filter((b) => b.paymentStatus === "dp");
  if (riderId) filtered = filtered.filter((b) => b.rider?.id === riderId);

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { customerId, locationId, numberOfBags, checkIn, checkOut, status, totalPrice: clientTotalPrice, paymentMethod, downPayment } = body;

    if (!customerId || !numberOfBags || !checkIn) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const VALID_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "NO_SHOW"];
    const bookingStatus: BookingStatus = VALID_STATUSES.includes(status) ? status : "PENDING";

    let location = null;
    if (locationId) {
      location = await prisma.storageLocation.findUnique({ where: { id: locationId } });
      if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const checkInDate = new Date(checkIn);
    let totalPrice: number;

    if (clientTotalPrice) {
      totalPrice = parseFloat(clientTotalPrice);
    } else if (checkOut && location) {
      const checkOutDate = new Date(checkOut);
      if (checkOutDate <= checkInDate) {
        return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
      }
      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      totalPrice = Math.max(1, diffDays) * location.pricePerDay * numberOfBags;
    } else {
      totalPrice = 0;
    }

    const referenceNumber = generateReferenceNumber();

    const QRCode = (await import("qrcode")).default;
    const qrCode = await QRCode.toDataURL(referenceNumber, { width: 300, margin: 2 });
    const qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

    const booking = await prisma.booking.create({
      data: {
        referenceNumber,
        qrCode: qrBase64,
        userId: session.user.id,
        customerId,
        locationId: locationId || null,
        pickupLocation: body.pickupLocation || "",
        dropOffLocation: body.dropOffLocation || "",
        checkIn: checkInDate,
        checkOut: body.checkOut ? new Date(body.checkOut) : null,
        numberOfBags,
        totalPrice,
        status: bookingStatus,
        payments: downPayment > 0
          ? { create: { amount: parseFloat(downPayment), method: paymentMethod || "CASH", status: "PAID", paidAt: new Date(), customerId } }
          : undefined,
      },
      include: { customer: { select: { name: true } }, location: { select: { name: true } } },
    });

    const { logActivity } = await import("@/lib/activity");
    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "Booking",
      entityId: booking.id,
      details: `Created booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
