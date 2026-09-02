import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { decimalsToNumbers } from "@/lib/serialize";
import type { BookingStatus } from "@/generated/prisma/client";
import { normalizeReference } from "@/lib/utils";
import { getSystemSettings, setting } from "@/lib/settings";
import { computeBookingPrice, getBookingPriceSettings, parseLuggageDetails } from "@/lib/pricing";

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
  const dateParam = searchParams.get("date");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const reference = searchParams.get("ref");

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
  if (session.user.role === "EMPLOYEE") {
    where.assignments = { some: { userId: session.user.id } };
  }
  if (reference) where.referenceNumber = normalizeReference(reference);
  if (statusFilter) {
    where.status = { in: statusFilter };
  }
  if (dateParam) {
    const day = new Date(`${dateParam}T00:00:00.000Z`);
    if (!Number.isNaN(day.getTime())) {
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);
      where.checkIn = { gte: day, lt: next };
    }
  } else if (dateFrom || dateTo) {
    const range: { gte?: Date; lt?: Date } = {};
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00.000Z`);
      if (!Number.isNaN(from.getTime())) range.gte = from;
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T00:00:00.000Z`);
      if (!Number.isNaN(to.getTime())) {
        to.setUTCDate(to.getUTCDate() + 1);
        range.lt = to;
      }
    }
    if (Object.keys(range).length) where.checkIn = range;
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
      },
      payments: { select: { amount: true, status: true, method: true, paidAt: true } },
      luggageItems: { select: { id: true, tagNumber: true, status: true } },
      ...(include === "chat" ? {
        _count: { select: { chatMessages: true } },
        chatMessages: { orderBy: { createdAt: "desc" as const }, take: 1 },
      } : {}),
    },
  });

  const chatBookingIds = include === "chat" ? bookings.map((booking) => booking.id) : [];
  const [customerChatStats, unreadChatStats, staffChatStats] = include === "chat" && chatBookingIds.length > 0
    ? await Promise.all([
        prisma.chatMessage.groupBy({ by: ["bookingId"], where: { bookingId: { in: chatBookingIds }, isFromCustomer: true }, _count: true, _max: { createdAt: true } }),
        prisma.chatMessage.groupBy({ by: ["bookingId"], where: { bookingId: { in: chatBookingIds }, isFromCustomer: true, isRead: false }, _count: true }),
        prisma.chatMessage.groupBy({ by: ["bookingId"], where: { bookingId: { in: chatBookingIds }, isFromCustomer: false }, _count: true, _max: { createdAt: true } }),
      ])
    : [[], [], []];
  const customerChatMap = new Map(customerChatStats.map((row) => [row.bookingId, row]));
  const unreadChatMap = new Map(unreadChatStats.map((row) => [row.bookingId, row._count]));
  const staffChatMap = new Map(staffChatStats.map((row) => [row.bookingId, row]));

  const mapped = bookings.map((b) => {
    const totalPaid = b.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    let paymentStatus: "full" | "dp" | "unpaid" = "unpaid";
    if (totalPaid >= Number(b.totalPrice) && Number(b.totalPrice) > 0) paymentStatus = "full";
    else if (totalPaid > 0) paymentStatus = "dp";

    const qrScanned = ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"].includes(b.status);
    const pickupRider = b.assignments.find((a) => a.phase !== "DROPOFF")?.user || null;
    const dropoffRider = b.assignments.find((a) => a.phase === "DROPOFF")?.user || null;
    const rider = pickupRider || dropoffRider;

    return {
      id: b.id,
      referenceNumber: b.referenceNumber,
      customer: b.customer,
      pickupLocation: b.pickupLocation,
      dropOffLocation: b.dropOffLocation,
      numberOfBags: b.numberOfBags,
      totalPrice: Number(b.totalPrice),
      status: b.status,
      createdAt: b.createdAt,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      location: b.location,
      luggageItems: b.luggageItems,
      qrScanned,
      paymentStatus,
      totalPaid,
      rider,
      pickupRider,
      dropoffRider,
      ...(include === "chat" ? {
        _count: b._count,
        lastMessage: b.chatMessages?.[0] || null,
        unreadCustomerCount: unreadChatMap.get(b.id) || 0,
        customerMessageCount: customerChatMap.get(b.id)?._count || 0,
        staffMessageCount: staffChatMap.get(b.id)?._count || 0,
        lastCustomerMessageAt: customerChatMap.get(b.id)?._max.createdAt || null,
        lastStaffMessageAt: staffChatMap.get(b.id)?._max.createdAt || null,
      } : {}),
    };
  });

  let filtered = mapped;
  if (paymentFilter === "full") filtered = filtered.filter((b) => b.paymentStatus === "full");
  else if (paymentFilter === "dp") filtered = filtered.filter((b) => b.paymentStatus === "dp");
  if (riderId) filtered = filtered.filter((b) => b.pickupRider?.id === riderId || b.dropoffRider?.id === riderId);

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getSystemSettings();
  if (setting(settings, "walk_in_mode_enabled", "false") !== "true") {
    return NextResponse.json({ error: "Walk-in booking mode is currently disabled in Settings" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      customerId,
      locationId,
      numberOfBags,
      checkIn,
      checkOut,
      status,
      paymentMethod,
      downPayment,
      luggageDetails,
      promoCode,
    } = body;

    if (!customerId || !numberOfBags || !checkIn) {
      const missing: string[] = [];
      if (!customerId) missing.push("Customer");
      if (!numberOfBags) missing.push("Luggage");
      if (!checkIn) missing.push("Check-in date");
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
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
    if (isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "Invalid check-in date" }, { status: 400 });
    }

    let checkOutDate: Date | null = null;
    if (checkOut) {
      checkOutDate = new Date(checkOut);
      if (isNaN(checkOutDate.getTime())) {
        return NextResponse.json({ error: "Invalid check-out date" }, { status: 400 });
      }
      if (checkOutDate <= checkInDate) {
        return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
      }
    }

    // Compute the authoritative price server-side from the declared luggage lines and the
    // admin-configured rates, multiplied by storage duration. We never trust a client-sent
    // total because it may be calculated from hardcoded prices or miss the storage-day
    // multiplier (which previously undercharged multi-day walk-in bookings).
    const { luggageLines, services } = parseLuggageDetails(luggageDetails || "");
    const storageDays = checkOutDate
      ? Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    const [priceSettings] = await Promise.all([getBookingPriceSettings()]);
    const computed = computeBookingPrice({ luggageLines, services, discount: 0, settings: priceSettings, storageDays });
    const orderAmount = computed.totalPrice;
    let totalPrice = orderAmount;

    let discount = 0;
    let promoCodeId: string | null = null;

    if (promoCode && orderAmount > 0) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (promo && promo.isActive && promo.usedCount < promo.maxUsage && (!promo.expiresAt || new Date() <= promo.expiresAt) && orderAmount >= Number(promo.minAmount)) {
        if (promo.type === "PERCENTAGE") {
          discount = orderAmount * (Number(promo.value) / 100);
          if (promo.maxDiscount) discount = Math.min(discount, Number(promo.maxDiscount));
        } else {
          discount = Number(promo.value);
        }
        discount = Math.min(orderAmount, Math.max(0, discount));
        if (discount > 0) {
          promoCodeId = promo.id;
          totalPrice = orderAmount - discount;
        }
      }
    }

    const referenceNumber = generateReferenceNumber(setting(settings, "tx_prefix", "DROPFLY"));

    const QRCode = (await import("qrcode")).default;
    const qrCode = await QRCode.toDataURL(referenceNumber, { width: 300, margin: 2 });
    const qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

    // Wrap the promo-code usage increment and booking creation in a transaction so the
    // promo's usedCount is rolled back if booking creation fails.
    const booking = await prisma.$transaction(async (tx) => {
      if (promoCodeId) {
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { usedCount: { increment: 1 } },
        });
      }
      return tx.booking.create({
        data: {
          referenceNumber,
          qrCode: qrBase64,
          userId: session.user.id,
          customerId,
          locationId: locationId || null,
          pickupLocation: body.pickupLocation || "",
          dropOffLocation: body.dropOffLocation || "",
          luggageDetails: luggageDetails || null,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          numberOfBags,
          totalPrice,
          discount,
          promoCodeId,
          status: bookingStatus,
          payments: downPayment > 0
            ? { create: { amount: parseFloat(downPayment), method: paymentMethod || "CASH", status: "PAID", paidAt: new Date(), customerId } }
            : undefined,
        },
        include: { customer: { select: { name: true } }, location: { select: { name: true } } },
      });
    });

    const { logActivity } = await import("@/lib/activity");
    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "Booking",
      entityId: booking.id,
      details: `Created booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(decimalsToNumbers(booking), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
