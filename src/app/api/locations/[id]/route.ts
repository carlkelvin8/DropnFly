import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { locationSchema } from "@/lib/validations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const location = await prisma.storageLocation.findUnique({
    where: { id },
  });

  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(location);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const location = await prisma.storageLocation.update({
      where: { id },
      data: {
        name: parsed.data.name,
        address: parsed.data.address,
        city: parsed.data.city,
        capacity: parsed.data.capacity,
        pricePerDay: parsed.data.pricePerDay,
        openingTime: parsed.data.openingTime,
        closingTime: parsed.data.closingTime,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(location);
  } catch {
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const bookingCount = await prisma.booking.count({ where: { locationId: id } });
    if (bookingCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${bookingCount} booking(s) reference this location` },
        { status: 400 }
      );
    }
    await prisma.storageLocation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}
