import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Reviews carry customer names and emails; operations roles only.
  if (!["ADMIN", "STAFF"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reviews = await prisma.bookingReview.findMany({
    include: {
      customer: { select: { name: true, email: true } },
      booking: { select: { referenceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reviews);
}
