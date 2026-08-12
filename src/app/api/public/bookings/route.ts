import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyBookingCreated, sendCustomerNotification } from "@/lib/notifications";
import { getCustomerSession } from "@/lib/customer-auth";
import { getSystemSettings, setting } from "@/lib/settings";
import { computeBookingPrice, getBookingPriceSettings, parseLuggageDetails } from "@/lib/pricing";

export async function POST(req: Request) {
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

    const body = await req.json();

    const { name, email, phone, countryOfOrigin, cityOfOrigin, pickupLocation, dropOffLocation, numberOfBags, luggageDetails, preferredDate, deliveryDate, promoCode, downPayment } = body;

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

    let discount = 0;
    let promoCodeId: string | null = null;

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (promo && promo.isActive && promo.usedCount < promo.maxUsage) {
        if (!promo.expiresAt || new Date() <= promo.expiresAt) {
          const computed = computeBookingPrice({ luggageLines, services, discount: 0, settings: priceSettings });
          const orderAmount = computed.totalPrice;
          if (orderAmount >= promo.minAmount) {
            if (promo.type === "PERCENTAGE") {
              discount = orderAmount * (promo.value / 100);
              if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
            } else {
              discount = promo.value;
            }
          }
          promoCodeId = promo.id;
        }
      }
    }

    const pricing = computeBookingPrice({ luggageLines, services, discount, settings: priceSettings });

    if (pricing.totalBags <= 0) {
      return NextResponse.json({ error: "Please select at least one bag (Luggage Types)" }, { status: 400 });
    }

    const maxBags = parseInt(setting(settings, "max_bags_per_booking", "0"));
    if (maxBags > 0 && pricing.totalBags > maxBags) {
      return NextResponse.json({ error: `Maximum of ${maxBags} bags per booking` }, { status: 400 });
    }

    const declaredBags = parseInt(numberOfBags);
    if (isNaN(declaredBags) || declaredBags !== pricing.totalBags) {
      return NextResponse.json({ error: "Luggage count mismatch" }, { status: 400 });
    }

    // Enforce time-slot capacity
    const slotQuery = async (date: Date, type: "pickup" | "delivery"): Promise<void> => {
      const defaults: Record<string, string> = {
        max_concurrent_pickups: "1",
        max_concurrent_deliveries: "1",
        pickup_slot_duration: "60",
        delivery_slot_duration: "60",
        operating_start: "08:00",
        operating_end: "17:00",
      };
      const isPickup = type === "pickup";
      const maxConcurrent = parseInt(setting(settings, isPickup ? "max_concurrent_pickups" : "max_concurrent_deliveries", defaults[isPickup ? "max_concurrent_pickups" : "max_concurrent_deliveries"]));
      const durationMin = parseInt(setting(settings, isPickup ? "pickup_slot_duration" : "delivery_slot_duration", defaults[isPickup ? "pickup_slot_duration" : "delivery_slot_duration"]));
      const operatingStart = setting(settings, "operating_start", defaults.operating_start);
      const operatingEnd = setting(settings, "operating_end", defaults.operating_end);
      const [startH, startM] = operatingStart.split(":").map(Number);
      const [endH, endM] = operatingEnd.split(":").map(Number);
      const slotStartMinutes = date.getHours() * 60 + date.getMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (slotStartMinutes < startMinutes || slotStartMinutes + durationMin > endMinutes) {
        throw new Error(`Selected ${type} time is outside operating hours`);
      }
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const existing = await prisma.booking.findMany({
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
        const t = dt.getHours() * 60 + dt.getMinutes();
        if (t >= slotStartMinutes && t < slotStartMinutes + durationMin) count++;
      }
      if (count >= maxConcurrent) {
        throw new Error(`The selected ${type} time slot is fully booked. Please choose another time.`);
      }
    };

    try {
      await slotQuery(checkInDate, "pickup");
      if (checkOutDate) await slotQuery(checkOutDate, "delivery");
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Slot unavailable" }, { status: 409 });
    }

    const customerSession = await getCustomerSession();

    let customer = await prisma.customer.findUnique({ where: { email } });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, email, phone, countryOfOrigin: countryOfOrigin || null, cityOfOrigin: cityOfOrigin || null },
      });
    } else {
      if (customerSession?.id === customer.id) {
        const updateData: Record<string, string> = { name, phone };
        if (countryOfOrigin) updateData.countryOfOrigin = countryOfOrigin;
        if (cityOfOrigin) updateData.cityOfOrigin = cityOfOrigin;
        customer = await prisma.customer.update({
          where: { email },
          data: updateData,
        });
      }
    }

    if (promoCodeId) {
      await prisma.promoCode.update({
        where: { id: promoCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }

    const txPrefix = setting(settings, "tx_prefix", "DROPFLY");
    const referenceNumber = generateReferenceNumber(txPrefix);

    const qrSize = parseInt(setting(settings, "qr_image_size", "300"));
    const qrCode = await QRCode.toDataURL(referenceNumber, {
      width: qrSize,
      margin: 2,
    });

    const qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

    const minDpPercent = parseInt(setting(settings, "min_dp_percentage", "0"));
    const requiredDownPayment = minDpPercent > 0 ? Math.ceil(pricing.totalPrice * (minDpPercent / 100)) : 0;
    const downPaymentAmount = downPayment ? parseFloat(downPayment) : 0;

    if (requiredDownPayment > 0 && downPaymentAmount < requiredDownPayment) {
      return NextResponse.json(
        { error: `A minimum down payment of ₱${requiredDownPayment.toFixed(2)} (${minDpPercent}%) is required` },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.create({
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
        status: "PENDING",
        payments: downPaymentAmount > 0
          ? { create: { amount: downPaymentAmount, method: "CASH", status: "PENDING", customerId: customer.id } }
          : undefined,
      },
    });

    try {
      await sendConfirmationEmail({
        to: email,
        customerName: name,
        referenceNumber,
        qrCodeBase64: qrBase64,
        pickupLocation,
        dropOffLocation,
        scheduledDate: checkInDate.toLocaleDateString("en-PH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    } catch {
      console.warn("Email sending failed, booking still created");
    }

    if (customer.password) {
      await sendCustomerNotification({
        customerId: customer.id,
        type: "booking_created",
        title: "Booking Confirmed",
        message: `Booking ${referenceNumber} has been created successfully.`,
        link: `/my-account/bookings/${booking.id}`,
      });
    }

    const staffUsers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true },
      select: { id: true },
    });

    await notifyBookingCreated(
      staffUsers.map((u) => u.id),
      referenceNumber,
      name
    );

    return NextResponse.json(
      {
        success: true,
        referenceNumber: booking.referenceNumber,
        qrCode: qrCode,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Booking creation error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
