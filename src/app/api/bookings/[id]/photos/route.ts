import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { photo } = await req.json();

    if (!photo) {
      return NextResponse.json({ error: "Photo data is required" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        luggagePhotos: [...booking.luggagePhotos, photo],
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Booking",
      entityId: id,
      details: "Added luggage photo",
    });

    return NextResponse.json({ photos: updated.luggagePhotos });
  } catch {
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { index } = await req.json();

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const photos = [...booking.luggagePhotos];
    if (index >= 0 && index < photos.length) {
      photos.splice(index, 1);
    }

    await prisma.booking.update({ where: { id }, data: { luggagePhotos: photos } });

    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
