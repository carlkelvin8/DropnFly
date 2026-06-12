import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const action = searchParams.get("action");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (entity) where.entity = entity;
  if (action) where.action = action;

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(logs);
}
