import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const count = await prisma.customerNotification.count({
    where: { customerId: session.id, isRead: false },
  });

  return NextResponse.json({ count });
}
