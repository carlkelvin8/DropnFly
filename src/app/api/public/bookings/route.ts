import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyBookingCreated, sendCustomerNotification } from "@/lib/notifications";
import { getCustomerSession } from "@/lib/customer-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, email, phone, countryOfOrigin, cityOfOrigin, pickupLocation, dropOffLocation, numberOfBags, luggageDetails, preferredDate, deliveryDate, promoCode, totalPrice, downPayment } = body;

    if (!name || !email || !phone || !pickupLocation || !dropOffLocation || !numberOfBags || !preferredDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const checkInDate = new Date(preferredDate);
    if (isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    if (checkInDate < new Date()) {
      return NextResponse.json({ error: "Pickup date must be in the future" }, { status: 400 });
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
    }

    const customerSession = await getCustomerSession();

    let customer = await prisma.customer.findUnique({ where: { email } });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, email, phone, countryOfOrigin: countryOfOrigin || null, cityOfOrigin: cityOfOrigin || null },
      });
    } else {
      const updateData: Record<string, string> = { name, phone };
      if (countryOfOrigin) updateData.countryOfOrigin = countryOfOrigin;
      if (cityOfOrigin) updateData.cityOfOrigin = cityOfOrigin;

      if (!customer.password && customerSession?.id === customer.id) {
        customer = await prisma.customer.update({
          where: { email },
          data: updateData,
        });
      } else if (!customer.password) {
        customer = await prisma.customer.update({
          where: { email },
          data: updateData,
        });
      }
    }

    const discount = 0;
    let promoCodeId: string | null = null;

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (promo && promo.isActive && promo.usedCount < promo.maxUsage) {
        if (!promo.expiresAt || new Date() <= promo.expiresAt) {
          promoCodeId = promo.id;
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }
    }

    const referenceNumber = generateReferenceNumber();

    const qrCode = await QRCode.toDataURL(referenceNumber, {
      width: 300,
      margin: 2,
    });

    const qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

    const downPaymentAmount = downPayment ? parseFloat(downPayment) : 0;

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
        numberOfBags: parseInt(numberOfBags),
        totalPrice: totalPrice ? parseFloat(totalPrice) : 0,
        discount,
        promoCodeId,
        status: "PENDING",
        payments: downPaymentAmount > 0
          ? { create: { amount: downPaymentAmount, method: "CASH", status: "PAID", paidAt: new Date(), customerId: customer.id } }
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
