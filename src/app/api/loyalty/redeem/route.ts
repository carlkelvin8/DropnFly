import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export async function POST(req: Request) {
  const customer = await getCustomerSession();
  if (!customer) return new NextResponse("Unauthorized", { status: 401 });

  const { points, bookingId } = await req.json();
  if (!points || points < 100) return new NextResponse("Minimum 100 points to redeem", { status: 400 });
  if (points % 100 !== 0) return new NextResponse("Points must be in multiples of 100", { status: 400 });

  const profile = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: { points: true },
  });

  if (!profile || profile.points < points) return new NextResponse("Insufficient points", { status: 400 });

  const discount = (points / 100) * 50;

  const [tx] = await prisma.$transaction([
    prisma.pointsTransaction.create({
      data: {
        customerId: customer.id,
        points: -points,
        type: "REDEEMED",
        reference: bookingId || null,
        description: `Redeemed ${points} points for ₱${discount} discount${bookingId ? ` on booking` : ""}`,
      },
    }),
    prisma.customer.update({
      where: { id: customer.id },
      data: { points: { decrement: points } },
    }),
  ]);

  return NextResponse.json({ success: true, discount, transaction: tx });
}
