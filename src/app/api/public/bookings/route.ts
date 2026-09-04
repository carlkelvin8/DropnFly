import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyBookingCreated, sendCustomerNotification } from "@/lib/notifications";
import { getSystemSettings, setting } from "@/lib/settings";
import { computeBookingPrice, getBookingPriceSettings, parseLuggageDetails } from "@/lib/pricing";
import { grantBookingAccess } from "@/lib/booking-access";
import { manilaDateStr, manilaMinutesOfDay, manilaDayRange } from "@/lib/manila-time";
import type { Prisma, Booking } from "@/generated/prisma/client";
import { rateLimit, requestKey } from "@/lib/rate-limit";

class StorageCapacityError extends Error {}

export async function POST(req: Request) {
  const limited = await rateLimit(`booking:${requestKey(req)}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many booking attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const [settings, priceSettings] = await Promise.all([
      getSystemSettings(),
      getBookingPriceSettings(),
    ]);

    if (setting(settings, "maintenance_mode_enabled", "false") === "true") {
      return NextResponse.json(
        { error: setting(settings, "maintenance_message", "We are currently undergoing scheduled maintenance. Please check back shortly.") },
        { status: 503 }
      );
    }
    if (setting(settings, "online_booking_enabled", "true") === "false") {
      return NextResponse.json({ error: "Online booking is currently disabled." }, { status: 503 });
    }

    const body = await req.json();

    const { name, email, phone, pickupLocation, dropOffLocation, numberOfBags, luggageDetails, preferredDate, deliveryDate, promoCode, downPayment } = body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    const missing: string[] = [];
    if (!name) missing.push("Full Name");
    if (!email) missing.push("Email Address");
    if (!phone) missing.push("Phone Number");
    if (!pickupLocation) missing.push("Pickup Location");
    if (!dropOffLocation) missing.push("Drop-off Location");
    if (!numberOfBags) missing.push("Luggage/Bag Selection");
    if (!preferredDate) missing.push("Pickup Date & Time");
    if (!luggageDetails) missing.push("Luggage Details");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || String(name).length > 120 || String(phone).length > 40 || String(pickupLocation).length > 500 || String(dropOffLocation).length > 500 || String(luggageDetails).length > 20_000) {
      return NextResponse.json({ error: "One or more booking fields are invalid or too long" }, { status: 400 });
    }
    if (body.countryOfOrigin && typeof body.countryOfOrigin === "string" && body.countryOfOrigin.length > 100) {
      return NextResponse.json({ error: "Country of Origin is too long" }, { status: 400 });
    }
    if (body.cityOfOrigin && typeof body.cityOfOrigin === "string" && body.cityOfOrigin.length > 100) {
      return NextResponse.json({ error: "City of Origin is too long" }, { status: 400 });
    }

    const safeCountry = typeof body.countryOfOrigin === "string" ? body.countryOfOrigin.slice(0, 100) : undefined;
    const safeCity = typeof body.cityOfOrigin === "string" ? body.cityOfOrigin.slice(0, 100) : undefined;

    const checkInDate = new Date(preferredDate);
    if (isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    if (checkInDate < new Date()) {
      return NextResponse.json({ error: "Pickup date must be in the future" }, { status: 400 });
    }

    const maxAdvanceDays = parseInt(setting(settings, "max_advance_booking_days", "0"));
    if (maxAdvanceDays > 0) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
      if (checkInDate > maxDate) {
        return NextResponse.json({ error: `Pickup date cannot be more than ${maxAdvanceDays} days ahead` }, { status: 400 });
      }
    }

    let checkOutDate: Date | null = null;
    if (deliveryDate) {
      checkOutDate = new Date(deliveryDate);
      if (isNaN(checkOutDate.getTime())) {
        return NextResponse.json({ error: "Invalid delivery date" }, { status: 400 });
      }
      if (checkOutDate <= checkInDate) {
        return NextResponse.json({ error: "Delivery date must be after pickup date" }, { status: 400 });
      }
      const minStorageDays = parseInt(setting(settings, "min_storage_days", "1"));
      const storageHours = (checkOutDate.getTime() - checkInDate.getTime()) / 3_600_000;
      if (minStorageDays > 0 && storageHours < minStorageDays * 24) {
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
    }

    const { luggageLines, services } = parseLuggageDetails(luggageDetails);
    const storageDays = checkOutDate
      ? Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    let discount = 0;
    let promoCodeId: string | null = null;

    if (promoCode && setting(settings, "discount_codes_enabled", "true") !== "false") {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (promo && promo.isActive && promo.usedCount < promo.maxUsage) {
        if (!promo.expiresAt || new Date() <= promo.expiresAt) {
          const computed = computeBookingPrice({ luggageLines, services, discount: 0, settings: priceSettings, storageDays });
          const orderAmount = computed.totalPrice;
          if (orderAmount >= Number(promo.minAmount)) {
            if (promo.type === "PERCENTAGE") {
              discount = orderAmount * (Number(promo.value) / 100);
              if (promo.maxDiscount) discount = Math.min(discount, Number(promo.maxDiscount));
            } else {
              discount = Number(promo.value);
            }
            if (discount > 0) promoCodeId = promo.id;
          }
        }
      }
    }

    const pricing = computeBookingPrice({ luggageLines, services, discount, settings: priceSettings, storageDays });

    if (pricing.totalBags <= 0) {
      return NextResponse.json({ error: "Please select at least one bag (Luggage Types)" }, { status: 400 });
    }

    const maxBags = parseInt(setting(settings, "max_bags_per_booking", "0"));
    if (maxBags > 0 && pricing.totalBags > maxBags) {
      return NextResponse.json({ error: `Maximum of ${maxBags} bags per booking` }, { status: 400 });
    }
    const maxSimultaneousBags = parseInt(setting(settings, "max_simultaneous_bags", "0"));

    const declaredBags = parseInt(numberOfBags);
    if (isNaN(declaredBags) || declaredBags !== pricing.totalBags) {
      return NextResponse.json({ error: "Luggage count mismatch" }, { status: 400 });
    }

    // Enforce time-slot capacity
    const slotQuery = async (date: Date, type: "pickup" | "delivery", db: Pick<Prisma.TransactionClient, "booking"> | typeof prisma = prisma): Promise<void> => {
      const defaults: Record<string, string> = {
        max_concurrent_pickups: "1",
        max_concurrent_deliveries: "1",
        pickup_slot_duration: "60",
        delivery_slot_duration: "60",
      };
      const isPickup = type === "pickup";
      const maxConcurrent = parseInt(setting(settings, isPickup ? "max_concurrent_pickups" : "max_concurrent_deliveries", defaults[isPickup ? "max_concurrent_pickups" : "max_concurrent_deliveries"]));
      const durationMin = parseInt(setting(settings, isPickup ? "pickup_slot_duration" : "delivery_slot_duration", defaults[isPickup ? "pickup_slot_duration" : "delivery_slot_duration"]));
      // The service operates 24 hours a day (customers may have flights at any hour), so the
      // selected hour is never rejected here based on an operating-hours window. Capacity is
      // still enforced below to prevent overbooking a slot.
      const slotStartMinutes = manilaMinutesOfDay(date);
      const { start: dayStart, end: dayEnd } = manilaDayRange(date);
      const existing = await db.booking.findMany({
        where: {
          status: { notIn: ["CANCELLED", "DELIVERED"] },
          ...(isPickup
            ? { checkIn: { gte: dayStart, lt: dayEnd } }
            : { checkOut: { gte: dayStart, lt: dayEnd } }
          ),
        },
        select: isPickup ? { checkIn: true } : { checkOut: true },
      });
      let count = 0;
      for (const b of existing) {
        const dt = isPickup ? (b as { checkIn: Date }).checkIn : (b as { checkOut: Date | null }).checkOut;
        if (!dt) continue;
        const t = manilaMinutesOfDay(dt);
        if (t >= slotStartMinutes && t < slotStartMinutes + durationMin) count++;
      }
      if (count >= maxConcurrent) {
        throw new Error(`The selected ${type} time slot is fully booked. Please choose another time.`);
      }
    };

    let customer = await prisma.customer.findUnique({ where: { email: normalizedEmail } });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: String(name).trim(), email: normalizedEmail, phone: String(phone).trim(), countryOfOrigin: safeCountry || null, cityOfOrigin: safeCity || null },
      });
    } else {
      const updateData: Record<string, string> = { name: String(name).trim(), phone: String(phone).trim() };
      if (safeCountry) updateData.countryOfOrigin = safeCountry;
      if (safeCity) updateData.cityOfOrigin = safeCity;
      customer = await prisma.customer.update({
        where: { email: normalizedEmail },
        data: updateData,
      });
    }

    const txPrefix = setting(settings, "tx_prefix", "DROPFLY");
    const qrSize = Math.min(1000, Math.max(100, parseInt(setting(settings, "qr_image_size", "300")) || 300));
    const qrPrefix = setting(settings, "qr_code_prefix", "DNF");

    // Online booking is a reservation-only flow: the customer is not required to pay during
    // booking. No down-payment is collected now; the full estimated cost becomes an outstanding
    // balance and the booking is NOT marked as paid. Payment is tracked independently.
    const initialStatus = "CONFIRMED";
    const downPaymentAmount = downPayment == null || downPayment === "" ? 0 : Number(downPayment);

    if (!Number.isFinite(downPaymentAmount) || downPaymentAmount < 0 || downPaymentAmount > pricing.totalPrice) {
      return NextResponse.json({ error: "Invalid down payment amount" }, { status: 400 });
    }

    let booking: Booking | undefined;
    let referenceNumber = "";
    let qrCode = "";
    let qrBase64 = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        referenceNumber = generateReferenceNumber(txPrefix);
        qrCode = await QRCode.toDataURL(`${qrPrefix}-${referenceNumber}`, {
          width: qrSize,
          margin: 2,
        });
        qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

        booking = await prisma.$transaction(async (tx) => {
          // Serialize reservations for these slots using Manila date (not UTC) so
          // 00:30 Manila doesn't lock a different advisory key than the query.
          const lockKeys = [checkInDate, checkOutDate].filter((d): d is Date => Boolean(d)).map((d) => `slot:${manilaDateStr(d)}:${d === checkInDate ? "pickup" : "delivery"}`);
          for (const key of lockKeys) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
          }
          if (promoCodeId) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${promoCodeId}`}))`;
          }
          if (maxSimultaneousBags > 0) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking:storage-capacity'))`;
            // PENDING reservations don't occupy physical storage yet
            const activeBagTotal = await tx.booking.aggregate({
              where: { status: { notIn: ["PENDING", "DELIVERED", "CANCELLED", "NO_SHOW"] } },
              _sum: { numberOfBags: true },
            });
            if (Number(activeBagTotal._sum.numberOfBags || 0) + pricing.totalBags > maxSimultaneousBags) {
              throw new StorageCapacityError("Storage capacity is full for the requested booking");
            }
          }
          await slotQuery(checkInDate, "pickup", tx);
          if (checkOutDate) await slotQuery(checkOutDate, "delivery", tx);

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
            customerId: customer.id,
            pickupLocation,
            dropOffLocation,
            luggageDetails: luggageDetails || null,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            numberOfBags: pricing.totalBags,
            totalPrice: pricing.totalPrice,
            discount: pricing.discount,
            promoCodeId,
            status: initialStatus,
            },
          });
        });
        break;
      } catch (e) {
        if ((e as { code?: string })?.code === "P2002" && attempt < 2) continue;
        throw e;
      }
    }
    if (!booking) {
      throw new Error("Failed to create booking");
    }

    await grantBookingAccess(booking.id, booking.customerId);

    // Send the confirmation email after the booking is committed. We await the
    // first attempt so the response reflects the real outcome (the confirmation
    // page then doesn't wrongly warn the customer that the email failed). If the
    // first attempt fails, we retry in the background (best-effort) rather than
    // blocking booking creation for the whole retry window.
    let confirmationEmailSent = false;
    if (initialStatus === "CONFIRMED") {
      const scheduledDate = checkInDate.toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      try {
        await sendConfirmationEmail({
          to: normalizedEmail,
          customerName: name,
          referenceNumber,
          qrCodeBase64: qrBase64,
          pickupLocation,
          dropOffLocation,
          scheduledDate,
          numberOfBags: booking.numberOfBags,
          totalPrice: Number(booking.totalPrice),
        });
        confirmationEmailSent = true;
      } catch (firstAttemptError) {
        console.error("Booking confirmation email first attempt failed:", firstAttemptError);
        void (async () => {
          for (let attempt = 1; attempt < 3; attempt += 1) {
            try {
              await sendConfirmationEmail({
                to: normalizedEmail,
                customerName: name,
                referenceNumber,
                qrCodeBase64: qrBase64,
                pickupLocation,
                dropOffLocation,
                scheduledDate,
                numberOfBags: booking.numberOfBags,
                totalPrice: Number(booking.totalPrice),
              });
              return;
            } catch (error) {
              console.error(`Booking confirmation email retry ${attempt + 1} failed:`, error);
            }
          }
        })();
      }
    }

    if (customer.password) {
      try {
        await sendCustomerNotification({
          customerId: customer.id,
          type: "booking_created",
          title: "Booking Confirmed",
          message: `Booking ${referenceNumber} has been created successfully.`,
          link: `/my-account/bookings/${booking.id}`,
        });
      } catch (e) {
        if (process.env.NODE_ENV === "development") console.warn("Notification failed:", e);
      }
    }

    const staffUsers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true },
      select: { id: true },
    });

    try {
      await notifyBookingCreated(
        staffUsers.map((u) => u.id),
        referenceNumber,
        name
      );
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.warn("Staff notification failed:", e);
    }

    return NextResponse.json(
      {
        success: true,
        referenceNumber: booking.referenceNumber,
        bookingId: booking.id,
        paymentAmount: downPaymentAmount,
        qrCode: qrCode,
        status: booking.status,
        confirmationEmailSent,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof StorageCapacityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Booking creation error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
