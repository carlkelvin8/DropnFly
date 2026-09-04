import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit location updates per rider to prevent DB flooding
  const limited = await rateLimit(`location:${session.user.id}:${requestKey(req)}`, 60, 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many location updates" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  try {
    const { latitude, longitude, accuracy } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
    }
    if (accuracy != null && (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)) {
      return NextResponse.json({ error: "Invalid accuracy" }, { status: 400 });
    }

    const update = await prisma.$transaction(async (tx) => {
      const loc = await tx.locationUpdate.create({
        data: {
          userId: session.user.id,
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
