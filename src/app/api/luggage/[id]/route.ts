import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "STAFF"].includes(session.user.role)) return new NextResponse("Forbidden", { status: 403 });

  try {
    const body = await req.json();
    const data: Record<string, string | Date | null> = {};

    if (body.status) data.status = body.status;
    if (body.location !== undefined) data.location = body.location;
    if (body.description !== undefined) data.description = body.description;
    if (body.flag !== undefined) data.flag = body.flag;
    if (body.status === "DELIVERED" || body.status === "CANCELLED") data.checkOutAt = new Date();

    const item = await prisma.luggageItem.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Luggage item not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to update luggage item" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "STAFF"].includes(session.user.role)) return new NextResponse("Forbidden", { status: 403 });

  try {
    await prisma.luggageItem.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Luggage item not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete luggage item" }, { status: 500 });
  }
}
