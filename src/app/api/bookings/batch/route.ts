import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids, action } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No bookings selected" }, { status: 400 });
    }

    if (action === "delete") {
      await prisma.booking.deleteMany({ where: { id: { in: ids } } });
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === "confirm") {
      await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: "CONFIRMED" },
      });
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === "deliver") {
      await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: "DELIVERED" },
      });
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === "cancel") {
      await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ success: true, count: ids.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Batch operation failed" }, { status: 500 });
  }
}
