import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  const updates = await prisma.locationUpdate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(updates.reverse());
}
