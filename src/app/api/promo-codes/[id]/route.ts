import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

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
    const promo = await prisma.promoCode.findUnique({ where: { id }, select: { code: true } });
    await prisma.promoCode.delete({ where: { id } });

    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entity: "PromoCode",
      entityId: id,
      details: `Deleted promo code ${promo?.code}`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete promo code" }, { status: 500 });
  }
}
