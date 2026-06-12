import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyBookingCreated } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, email, phone, pickupLocation, dropOffLocation, numberOfBags, luggageDetails, preferredDate } = body;

    if (!name || !email || !phone || !pickupLocation || !dropOffLocation || !numberOfBags || !preferredDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let customer = await prisma.customer.findUnique({ where: { email } });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, email, phone },
      });
    } else {
      customer = await prisma.customer.update({
        where: { email },
        data: { name, phone },
      });
    }

    const referenceNumber = generateReferenceNumber();

    const qrCode = await QRCode.toDataURL(referenceNumber, {
      width: 300,
      margin: 2,
    });

    const qrBase64 = qrCode.replace(/^data:image\/png;base64,/, "");

    const booking = await prisma.booking.create({
      data: {
        referenceNumber,
        qrCode: qrBase64,
        customerId: customer.id,
        pickupLocation,
        dropOffLocation,
        luggageDetails: luggageDetails || null,
        checkIn: new Date(preferredDate),
        numberOfBags: parseInt(numberOfBags),
        status: "PENDING",
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
        scheduledDate: new Date(preferredDate).toLocaleDateString("en-PH", {
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
