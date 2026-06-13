import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      points: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { points: "desc" },
  });

  return NextResponse.json(customers);
}
