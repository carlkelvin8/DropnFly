import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export async function GET() {
  const customer = await getCustomerSession();
  if (!customer) return new NextResponse("Unauthorized", { status: 401 });

  const [profile, history] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customer.id },
      select: { points: true },
    }),
    prisma.pointsTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ points: profile?.points || 0, history });
}
