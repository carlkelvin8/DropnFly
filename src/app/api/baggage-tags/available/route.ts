import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usedTags = await prisma.luggageItem.findMany({
    select: { tagNumber: true },
    where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
  });

  const usedSet = new Set(usedTags.map((t) => t.tagNumber));

  const allTags = await prisma.baggageTag.findMany({
    orderBy: { tagNumber: "asc" },
    take: 500,
  });

  const mapped = allTags.map((t) => ({
    ...t,
    isUsed: usedSet.has(t.tagNumber) || t.status !== "AVAILABLE",
  }));

  return NextResponse.json({ tags: mapped, usedTagNumbers: [...usedSet] });
}
