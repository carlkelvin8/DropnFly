import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "STAFF"].includes(session.user.role)) return new NextResponse("Forbidden", { status: 403 });

  try {
    const body = await req.json();
    const { status } = body;
    if (!["APPROVED", "REJECTED"].includes(status)) return new NextResponse("Invalid status", { status: 400 });

    const extension = await prisma.bookingExtension.findUnique({ where: { id } });
    if (!extension) return new NextResponse("Extension not found", { status: 404 });
    if (extension.status !== "PENDING") return new NextResponse("Already reviewed", { status: 400 });

    const updated = await prisma.bookingExtension.update({
      where: { id },
      data: { status, reviewedById: session.user.id, reviewedAt: new Date() },
    });

    if (status === "APPROVED") {
      await prisma.booking.update({
        where: { id: extension.bookingId },
        data: { checkOut: extension.requestedCheckOut },
      });
    }

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to review extension" }, { status: 500 });
  }
}
