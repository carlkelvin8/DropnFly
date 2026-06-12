import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferenceNumber } from "@/lib/reference";
import { logActivity } from "@/lib/activity";
import { bookingSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      location: { select: { name: true, city: true } },
      user: { select: { name: true } },
    },
  });

  return NextResponse.json(bookings);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      customerId,
      locationId,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      numberOfBags,
      status,
    } = parsed.data;

    const location = await prisma.storageLocation.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const totalPrice = Math.max(1, diffDays) * location.pricePerDay * numberOfBags;

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
        userId: session.user.id,
        customerId,
        locationId,
        pickupLocation: body.pickupLocation || "",
        dropOffLocation: body.dropOffLocation || "",
        checkIn,
        checkOut,
        numberOfBags,
        totalPrice,
        status: (status || "PENDING") as "PENDING" | "CONFIRMED" | "RECEIVED" | "IN_STORAGE" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED",
      },
      include: {
        customer: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "Booking",
      entityId: booking.id,
      details: `Created booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
