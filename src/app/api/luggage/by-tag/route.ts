import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tagNumber = (searchParams.get("tagNumber") || "").trim().toUpperCase();
  const referenceNumber = searchParams.get("referenceNumber") || "";

  if (!tagNumber) {
    return NextResponse.json({ error: "Tag number is required" }, { status: 400 });
  }

  const item = await prisma.luggageItem.findUnique({
    where: { tagNumber },
    include: {
      booking: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          numberOfBags: true,
          pickupLocation: true,
          dropOffLocation: true,
          checkIn: true,
          checkOut: true,
          customer: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: `No luggage found with tag number ${tagNumber}` }, { status: 404 });
  }

  if (referenceNumber && normalizeReference(referenceNumber) !== item.booking.referenceNumber) {
    return NextResponse.json({ error: "Tag number does not match the booking number" }, { status: 400 });
  }

  const siblingCount = await prisma.luggageItem.count({
    where: {
      bookingId: item.bookingId,
      status: { notIn: ["IN_STORAGE", "DELIVERED"] },
    },
  });

  return NextResponse.json({
    luggage: item,
    booking: item.booking,
    remaining: siblingCount,
    storageEligible:
      item.booking.status === "RECEIVED" ||
      item.booking.status === "IN_STORAGE",
  });
}
