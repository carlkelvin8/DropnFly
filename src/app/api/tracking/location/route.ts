import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Only employees can publish live task locations" }, { status: 403 });
  }

  // Rate limit location updates per rider to prevent DB flooding
  const limited = await rateLimit(`location:${session.user.id}:${requestKey(req)}`, 60, 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many location updates" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  try {
    const { latitude, longitude, accuracy, bookingId } = await req.json();

    if (typeof bookingId !== "string" || !bookingId) {
      return NextResponse.json({ error: "An active booking is required" }, { status: 400 });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
    }
    if (accuracy != null && (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)) {
      return NextResponse.json({ error: "Invalid accuracy" }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        status: { in: ["CONFIRMED", "RECEIVED", "OUT_FOR_DELIVERY"] },
        pickupStartedAt: { not: null },
        assignments: { some: { userId: session.user.id } },
      },
      select: { status: true, assignments: { select: { userId: true, phase: true } } },
    });
    const activePhase = booking?.status === "OUT_FOR_DELIVERY" ? "DROPOFF" : "PICKUP";
    const assignedToActivePhase = booking?.assignments.some((assignment) =>
      assignment.userId === session.user.id && assignment.phase === activePhase
    );
    if (!booking || !assignedToActivePhase) {
      return NextResponse.json({ error: "No active assigned task for this location update" }, { status: 403 });
    }

    const update = await prisma.$transaction(async (tx) => {
      const loc = await tx.locationUpdate.create({
        data: {
          userId: session.user.id,
          bookingId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
        },
      });
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          currentLat: latitude,
          currentLng: longitude,
          lastLocationUpdate: new Date(),
        },
      });
      return loc;
    });

    return NextResponse.json(update, { status: 201 });
  } catch (e) {
    console.error("Location update failed:", e);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}
