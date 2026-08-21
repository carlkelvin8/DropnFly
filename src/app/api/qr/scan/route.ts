import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import type { BookingStatus } from "@/generated/prisma/client";

const VALID_STATUS_FLOW = [
  "PENDING",
  "CONFIRMED",
  "RECEIVED",
  "IN_STORAGE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const FINAL_BOOKING_STATUSES = ["CANCELLED", "NO_SHOW", "DELIVERED"];

function cleanTagNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s]+/g, " ");
}

async function handleLuggageIntake({
  session,
  tagNumber,
  referenceNumber,
  photo,
  note,
  latitude,
  longitude,
}: {
  session: { user: { id: string } };
  tagNumber: string;
  referenceNumber?: string;
  photo?: string;
  note?: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const cleanTag = cleanTagNumber(tagNumber);
  if (!cleanTag) {
    return NextResponse.json({ error: "Baggage tag number is required" }, { status: 400 });
  }
  if (!photo) {
    return NextResponse.json({ error: "A luggage verification photo is required for storage intake" }, { status: 400 });
  }

  const item = await prisma.luggageItem.findUnique({
    where: { tagNumber: cleanTag },
    include: {
      booking: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          customerId: true,
          pickupLocation: true,
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: `No luggage found with tag number ${cleanTag}` }, { status: 404 });
  }

  if (referenceNumber && normalizeReference(referenceNumber) !== item.booking.referenceNumber) {
    return NextResponse.json({ error: "Tag number does not match the booking number" }, { status: 400 });
  }

  const booking = item.booking;
  if (FINAL_BOOKING_STATUSES.includes(booking.status)) {
    return NextResponse.json({ error: "This booking cannot accept storage intake" }, { status: 400 });
  }

  if (!["RECEIVED", "IN_STORAGE"].includes(booking.status)) {
    return NextResponse.json(
      { error: `Luggage cannot be stored while booking is ${booking.status}. Complete collection first.` },
      { status: 400 }
    );
  }

  if (item.status === "IN_STORAGE") {
    return NextResponse.json({ error: "This luggage is already in storage" }, { status: 400 });
  }
  if (item.status === "DELIVERED" || item.status === "CANCELLED") {
    return NextResponse.json({ error: "This luggage item is already completed" }, { status: 400 });
  }

  await prisma.luggageItem.update({
    where: { id: item.id },
    data: { status: "IN_STORAGE", location: booking.pickupLocation || item.location || null },
  });

  const remaining = await prisma.luggageItem.count({
    where: { bookingId: booking.id, status: { notIn: ["IN_STORAGE", "DELIVERED"] } },
  });

  const bookingStatus: BookingStatus =
    remaining === 0 && booking.status === "RECEIVED" ? "IN_STORAGE" : (booking.status as BookingStatus);

  let updatedBooking = null;
  if (bookingStatus !== booking.status) {
    updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: bookingStatus },
    });
  }

  await prisma.scanEvent.create({
    data: {
      bookingId: booking.id,
      userId: session.user.id,
      status: bookingStatus,
      photo: photo || null,
      note: note
        ? `${note} — Luggage intake at storage (tag ${cleanTag})`
        : `Luggage intake at storage (tag ${cleanTag})`,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "SCAN",
    entity: "LuggageItem",
    entityId: item.id,
    details: `Luggage ${cleanTag} stored for booking ${booking.referenceNumber}${
      bookingStatus === "IN_STORAGE" && updatedBooking ? " — booking now in storage" : ""
    }`,
  });

  return NextResponse.json({
    success: true,
    luggage: {
      id: item.id,
      tagNumber: item.tagNumber,
      status: "IN_STORAGE",
      bookingId: booking.id,
    },
    bookingReference: booking.referenceNumber,
    bookingStatus,
    remaining,
    message: `Luggage ${cleanTag} marked in storage`,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      referenceNumber,
      status,
      photo,
      note,
      latitude,
      longitude,
      customerVerified,
      tagNumbers,
      luggageScan,
      tagNumber,
    } = await req.json();

    if (luggageScan) {
      return handleLuggageIntake({
        session,
        tagNumber,
        referenceNumber,
        photo,
        note,
        latitude,
        longitude,
      });
    }

    if (!referenceNumber || !status) {
      return NextResponse.json({ error: "Reference number and status are required" }, { status: 400 });
    }

    if (!VALID_STATUS_FLOW.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUS_FLOW.join(", ")}` }, { status: 400 });
    }

    if (status === "DELIVERED" && !customerVerified) {
      return NextResponse.json({ error: "Customer QR verification is required before confirming delivery" }, { status: 400 });
    }
    if (status === "IN_STORAGE" && !photo) {
      return NextResponse.json({ error: "A luggage verification photo is required before marking a booking in storage" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { referenceNumber: normalizeReference(referenceNumber) },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        customerId: true,
        numberOfBags: true,
        pickupLocation: true,
        luggagePhotos: true,
        assignments: { select: { userId: true, phase: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
      return NextResponse.json({ error: "Cannot update a cancelled or no-show booking" }, { status: 400 });
    }

    // === Drop-off ownership enforcement ===
    if (session.user.role === "EMPLOYEE" && ["OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) {
      const dropoffAssignments = booking.assignments.filter((a) => a.phase === "DROPOFF");
      const anyAssignment = booking.assignments.some((a) => a.userId === session.user.id);
      const isDropoffRider = dropoffAssignments.some((a) => a.userId === session.user.id);
      if (dropoffAssignments.length === 0) {
        if (!anyAssignment) {
          return NextResponse.json(
            { error: "You are not assigned to this booking. Only the assigned employee can update it." },
            { status: 403 }
          );
        }
      } else if (!isDropoffRider) {
        return NextResponse.json(
          { error: "Only the assigned drop-off employee can update this booking." },
          { status: 403 }
        );
      }
    }

    const currentIdx = VALID_STATUS_FLOW.indexOf(booking.status);
    const newIdx = VALID_STATUS_FLOW.indexOf(status);
    if (newIdx <= currentIdx && booking.status !== "PENDING") {
      return NextResponse.json({ error: "Cannot move to a previous or same status" }, { status: 400 });
    }

    // === Luggage collection at physical location: RECEIVED + tag assignment ===
    const tagList =
      status === "RECEIVED" && Array.isArray(tagNumbers)
        ? tagNumbers.map((t) => cleanTagNumber(String(t))).filter(Boolean)
        : [];

    const createdItems: { id: string; tagNumber: string; bookingId: string }[] = [];

    if (status === "RECEIVED" && tagList.length > 0) {
      const existingCount = await prisma.luggageItem.count({ where: { bookingId: booking.id } });
      const maxAllowed = booking.numberOfBags;
      const remainingSlots = maxAllowed - existingCount;
      if (remainingSlots <= 0) {
        return NextResponse.json({ error: "All baggage slots already filled for this booking" }, { status: 400 });
      }
      if (tagList.length > remainingSlots) {
        return NextResponse.json(
          { error: `Too many tags. Booking allows ${remainingSlots} more luggage item(s).` },
          { status: 400 }
        );
      }
      if (new Set(tagList).size !== tagList.length) {
        return NextResponse.json({ error: "Duplicate tag numbers entered" }, { status: 400 });
      }

      const duplicate = await prisma.luggageItem.findFirst({
        where: {
          tagNumber: { in: tagList },
          status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: `Tag number ${duplicate.tagNumber} is already assigned to another booking` }, { status: 400 });
      }

      for (const tag of tagList) {
        const item = await prisma.luggageItem.create({
          data: {
            bookingId: booking.id,
            tagNumber: tag,
            status: "CHECKED_IN",
            location: booking.pickupLocation || null,
          },
        });
        createdItems.push({ id: item.id, tagNumber: item.tagNumber, bookingId: item.bookingId });

        const physicalTag = await prisma.baggageTag.findUnique({ where: { tagNumber: tag } });
        if (physicalTag) {
          await prisma.baggageTag.update({
            where: { id: physicalTag.id },
            data: {
              status: "ASSIGNED",
              bookingId: booking.id,
              luggageItemId: item.id,
              assignedAt: new Date(),
            },
          });
        } else {
          await prisma.baggageTag.create({
            data: {
              tagNumber: tag,
              status: "ASSIGNED",
              bookingId: booking.id,
              luggageItemId: item.id,
              assignedAt: new Date(),
            },
          });
        }
      }
    }

    const [updatedBooking] = await Promise.all([
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: status as BookingStatus,
          ...(status === "RECEIVED" && photo && booking.luggagePhotos.length < 10
            ? { luggagePhotos: [...booking.luggagePhotos, photo] }
            : {}),
        },
      }),
      prisma.scanEvent.create({
        data: {
          bookingId: booking.id,
          userId: session.user.id,
          status,
          photo: photo || null,
          note:
            status === "RECEIVED"
              ? tagList.length > 0
                ? `${note ? `${note} — ` : ""}Luggage collected, tags: ${tagList.join(", ")}`
                : note || "Luggage collected at physical location"
              : customerVerified && status === "DELIVERED"
              ? `${note ? `${note} — ` : ""}Customer QR verified`
              : note || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "SCAN",
      entity: "Booking",
      entityId: booking.id,
      details:
        status === "RECEIVED" && tagList.length > 0
          ? `QR scan: luggage collected (${tagList.length} item(s) tagged) for ${booking.referenceNumber}`
          : `QR scan: status updated to ${status} for ${booking.referenceNumber}`,
    });

    if (status === "DELIVERED") {
      const existingPoints = await prisma.pointsTransaction.findFirst({
        where: { reference: booking.id, type: "EARNED" },
      });
      if (!existingPoints) {
        const pointsEarned = Math.floor(updatedBooking.totalPrice / 10);
        if (pointsEarned > 0) {
          await Promise.all([
            prisma.customer.update({
              where: { id: booking.customerId },
              data: { points: { increment: pointsEarned } },
            }),
            prisma.pointsTransaction.create({
              data: {
                customerId: booking.customerId,
                points: pointsEarned,
                type: "EARNED",
                reference: booking.id,
                description: `Earned from booking ${booking.referenceNumber}`,
              },
            }),
          ]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      status,
      luggage: createdItems,
      message:
        status === "RECEIVED" && tagList.length > 0
          ? `Luggage collected and ${tagList.length} tag(s) assigned for ${booking.referenceNumber}`
          : `Booking ${booking.referenceNumber} updated to ${status}`,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("QR scan error:", error);
    }
    return NextResponse.json({ error: "Failed to process QR scan" }, { status: 500 });
  }
}
