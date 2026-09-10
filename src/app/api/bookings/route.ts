import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { decimalsToNumbers } from "@/lib/serialize";
import type { BookingStatus } from "@/generated/prisma/client";
import { normalizeReference } from "@/lib/utils";
import { getSystemSettings, setting } from "@/lib/settings";
import { computeBookingPrice, getBookingPriceSettings, parseLuggageDetails } from "@/lib/pricing";
import { manilaDateStr, manilaDayRange, manilaMinutesOfDay } from "@/lib/manila-time";
import { fleetCapacity, movementsOverlappingSlot } from "@/lib/fleet-capacity";

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
      customer: {
        ...b.customer,
        name: (b as unknown as { customerNameSnapshot?: string | null }).customerNameSnapshot || b.customer.name,
        email: (b as unknown as { customerEmailSnapshot?: string | null }).customerEmailSnapshot || b.customer.email,
      } as unknown as typeof b.customer,
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

class StorageCapacityError extends Error {}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only staff and administrators can create walk-in bookings" }, { status: 403 });
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

    // Require same complete information as online booking: customer, pickup + delivery, luggage
    if (!customerId || !numberOfBags || !checkIn || !body.pickupLocation || !body.dropOffLocation) {
      const missing: string[] = [];
      if (!customerId) missing.push("Customer");
      if (!body.pickupLocation) missing.push("Pickup Location (Terminal + Airline)");
      if (!body.dropOffLocation) missing.push("Drop-off Location (Terminal + Airline)");
      if (!numberOfBags) missing.push("Luggage");
      if (!checkIn) missing.push("Pickup Date & Time Slot");
      if (!checkOut) missing.push("Delivery Date & Time Slot");
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }
    if (String(body.pickupLocation).length > 500 || String(body.dropOffLocation).length > 500) {
      return NextResponse.json({ error: "Pickup or drop-off location is too long" }, { status: 400 });
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
    // Snapshot of what staff typed for this specific booking — even when
    // same email is reused (Katrina Divivar → Carl Manahan), the booking
    // keeps its own name so the dashboard shows Carl for the new row while
    // the old row stays Katrina.
    const snapName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const snapPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
    const snapCountry = body.customerCountryOfOrigin || body.countryOfOrigin || null;
    const snapCity = body.customerCityOfOrigin || body.cityOfOrigin || null;

    const checkInDate = new Date(checkIn);
    if (isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "Invalid check-in date" }, { status: 400 });
    }
    // Enforce max advance booking (same as online)
    const maxAdvanceDays = parseInt(setting(settings, "max_advance_booking_days", "0"));
    if (maxAdvanceDays > 0) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
      if (checkInDate > maxDate) {
        return NextResponse.json({ error: `Pickup date cannot be more than ${maxAdvanceDays} days ahead` }, { status: 400 });
      }
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
      const minStorageDays = parseInt(setting(settings, "min_storage_days", "1"));
      const storageDaysForMin = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (minStorageDays > 0 && storageDaysForMin < minStorageDays) {
        return NextResponse.json({ error: `Storage period must be at least ${minStorageDays} day${minStorageDays === 1 ? "" : "s"}` }, { status: 400 });
      }
      const maxStorageDays = parseInt(setting(settings, "max_storage_days", "0"));
      if (maxStorageDays > 0) {
        const maxCheckOut = new Date(checkInDate);
        maxCheckOut.setDate(maxCheckOut.getDate() + maxStorageDays);
        if (checkOutDate > maxCheckOut) {
          return NextResponse.json({ error: `Storage period cannot exceed ${maxStorageDays} days` }, { status: 400 });
        }
      }
    } else {
      return NextResponse.json({ error: "Delivery date & time slot is required (same as online booking)" }, { status: 400 });
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
    const declaredBags = parseInt(numberOfBags);
    if (computed.totalBags <= 0) {
      return NextResponse.json({ error: "Please select at least one bag" }, { status: 400 });
    }
    // Enforce max_bags_per_booking (same as online booking)
    const maxBags = parseInt(setting(settings, "max_bags_per_booking", "0"));
    if (maxBags > 0 && computed.totalBags > maxBags) {
      return NextResponse.json({ error: `Maximum of ${maxBags} bags per booking` }, { status: 400 });
    }
    if (isNaN(declaredBags) || declaredBags !== computed.totalBags) {
      return NextResponse.json({ error: "Luggage count mismatch" }, { status: 400 });
    }
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

    // Validate payment amount
    const downPaymentNum = downPayment == null || downPayment === "" ? 0 : Number(downPayment);
    if (!Number.isFinite(downPaymentNum) || downPaymentNum < 0 || downPaymentNum > totalPrice) {
      return NextResponse.json({ error: "Invalid down payment amount" }, { status: 400 });
    }

    const referenceNumber = generateReferenceNumber(setting(settings, "tx_prefix", "DROPFLY"));

    const QRCode = (await import("qrcode")).default;
    const qrCode = await QRCode.toDataURL(referenceNumber, { width: 300, margin: 2 });
    const qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

    // Capacity & slot checks — identical to public flow (operating hours/days + slot fullness)
    const slotQueryStaff = async (date: Date, type: "pickup" | "delivery", db: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma): Promise<void> => {
      const defaults: Record<string, string> = {
        max_concurrent_pickups: "1",
        max_concurrent_deliveries: "1",
        pickup_slot_duration: "60",
        delivery_slot_duration: "60",
        operating_start: "00:00",
        operating_end: "23:59",
        store_operating_days: "0,1,2,3,4,5,6",
      };
      const isPickup = type === "pickup";
      const maxConcurrent = fleetCapacity(settings);
      const durationMin = Math.max(15, parseInt(setting(settings, isPickup ? "pickup_slot_duration" : "delivery_slot_duration", defaults[isPickup ? "pickup_slot_duration" : "delivery_slot_duration"])) || 60);
      const { manilaWeekday } = await import("@/lib/manila-time");
      const weekday = String(manilaWeekday(date));
      const operatingDays = setting(settings, "store_operating_days", defaults.store_operating_days).split(",").map((s) => s.trim());
      if (!operatingDays.includes(weekday)) {
        throw new Error("The store is closed on the selected pickup day. Please choose another date.");
      }
      const operatingStart = setting(settings, "operating_start", defaults.operating_start);
      const operatingEnd = setting(settings, "operating_end", defaults.operating_end);
      const parseHM = (v: string) => {
        const [h, m] = v.split(":").map(Number);
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
      };
      const startMin = parseHM(operatingStart);
      let endMin = parseHM(operatingEnd);
      if (endMin === 1439) endMin = 1440;
      if (endMin === 0 && (operatingEnd === "24:00" || operatingEnd === "00:00")) endMin = 1440;
      const slotStartMinutes = manilaMinutesOfDay(date);
      if (slotStartMinutes < startMin || slotStartMinutes + durationMin > endMin) {
        throw new Error(`Selected ${type} time is outside operating hours (${operatingStart}–${operatingEnd}). Please choose another time.`);
      }
      const { start: dayStart, end: dayEnd } = manilaDayRange(date);
      const existing = await (db as typeof prisma).booking.findMany({
        where: {
          status: { notIn: ["CANCELLED", "DELIVERED"] },
          OR: [
            { checkIn: { gte: dayStart, lt: dayEnd } },
            { checkOut: { gte: dayStart, lt: dayEnd } },
          ],
        },
        select: { checkIn: true, checkOut: true },
      });
      const pickupDuration = Math.max(15, parseInt(setting(settings, "pickup_slot_duration", "60")) || 60);
      const deliveryDuration = Math.max(15, parseInt(setting(settings, "delivery_slot_duration", "60")) || 60);
      const movements = existing.flatMap((booking) => [
        ...(booking.checkIn >= dayStart && booking.checkIn < dayEnd
          ? [{ startMinutes: manilaMinutesOfDay(booking.checkIn), durationMinutes: pickupDuration }]
          : []),
        ...(booking.checkOut && booking.checkOut >= dayStart && booking.checkOut < dayEnd
          ? [{ startMinutes: manilaMinutesOfDay(booking.checkOut), durationMinutes: deliveryDuration }]
          : []),
      ]);
      const count = movementsOverlappingSlot(slotStartMinutes, durationMin, movements);
      if (count >= maxConcurrent) {
        throw new Error(`All fleet vehicles are occupied during the selected ${type} time. Please choose another slot.`);
      }
    };

    const booking = await prisma.$transaction(async (tx) => {
      // Advisory locks for slot + promo + capacity to serialize concurrent staff bookings
      const lockKeys = [...new Set([checkInDate, checkOutDate]
        .filter((d): d is Date => Boolean(d))
        .map((d) => `fleet-slot:${manilaDateStr(d)}`))].sort();
      for (const key of lockKeys) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      }
      if (promoCodeId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${promoCodeId}`}))`;
      }
      const maxSimultaneousBags = parseInt(setting(settings, "max_simultaneous_bags", "0"));
      if (maxSimultaneousBags > 0) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking:storage-capacity'))`;
        const activeBagTotal = await tx.booking.aggregate({
          where: { status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] } },
          _sum: { numberOfBags: true },
        });
        if (Number(activeBagTotal._sum.numberOfBags || 0) + computed.totalBags > maxSimultaneousBags) {
          throw new StorageCapacityError(`Storage capacity is full (${activeBagTotal._sum.numberOfBags || 0}/${maxSimultaneousBags} bags in storage). Please try a later date or contact admin to increase capacity.`);
        }
      }
      await slotQueryStaff(checkInDate, "pickup", tx);
      if (checkOutDate) await slotQueryStaff(checkOutDate, "delivery", tx);

      if (promoCodeId) {
        const promoForUpdate = await tx.promoCode.findUnique({ where: { id: promoCodeId }, select: { maxUsage: true } });
        if (!promoForUpdate) throw new Error("Promo code is no longer available");
        const claimed = await tx.promoCode.updateMany({
          where: {
            id: promoCodeId,
            isActive: true,
            usedCount: { lt: promoForUpdate.maxUsage },
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new Error("Promo code is no longer available");
      }
      return tx.booking.create({
        data: {
          referenceNumber,
          qrCode: qrBase64,
          userId: session.user.id,
          customerId,
          customerNameSnapshot: snapName || customer.name,
          customerEmailSnapshot: customer.email,
          customerPhoneSnapshot: snapPhone || customer.phone,
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
          payments: downPaymentNum > 0
            ? { create: { amount: downPaymentNum, method: paymentMethod || "CASH", status: "PAID", paidAt: new Date(), customerId } }
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
  } catch (e) {
    if (e instanceof StorageCapacityError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("fleet vehicles are occupied") || msg.includes("fully booked") || msg.includes("outside operating hours") || msg.includes("closed on the selected")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("Promo code")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
