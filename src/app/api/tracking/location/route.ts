import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { latitude, longitude, accuracy } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const [update] = await Promise.all([
      prisma.locationUpdate.create({
        data: {
          userId: session.user.id,
          latitude,
          longitude,
          accuracy: accuracy || null,
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          currentLat: latitude,
          currentLng: longitude,
          lastLocationUpdate: new Date(),
        },
      }),
    ]);

    return NextResponse.json(update, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}
