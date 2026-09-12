import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

function cleanTag(value: string): string {
  return String(value).trim().toUpperCase().replace(/\s+/g, " ");
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "STAFF"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim().toUpperCase() || "";
  const status = url.searchParams.get("status") || "";

  const tags = await prisma.baggageTag.findMany({
    where: {
      ...(search ? { tagNumber: { contains: search } } : {}),
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      tagNumber: true,
      status: true,
      assignedAt: true,
      createdAt: true,
      booking: { select: { referenceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const counts = await prisma.baggageTag.groupBy({
    by: ["status"],
    _count: true,
  });
  const total = await prisma.baggageTag.count();

  return NextResponse.json({ tags, counts, total });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { numbers } = await req.json();
    const cleanList = Array.isArray(numbers)
      ? Array.from(new Set(numbers.map((tag) => cleanTag(String(tag))).filter(Boolean)))
      : [];
    if (cleanList.length === 0) {
      return NextResponse.json({ error: "Enter at least one baggage tag number" }, { status: 400 });
    }
    if (cleanList.length > 500) {
      return NextResponse.json({ error: "Maximum 500 tags per save. Add them in smaller batches." }, { status: 413 });
    }

    const existing = await prisma.baggageTag.findMany({
      where: { tagNumber: { in: cleanList } },
      select: { tagNumber: true },
    });
    const existingSet = new Set(existing.map((t) => t.tagNumber));
    const toCreate = cleanList.filter((t) => !existingSet.has(t));

    if (toCreate.length > 0) {
      await prisma.baggageTag.createMany({
        data: toCreate.map((tagNumber) => ({ tagNumber, status: "AVAILABLE" })),
        skipDuplicates: true,
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "BaggageTag",
      entityId: toCreate[0] ?? "",
      details: `Added ${toCreate.length} baggage tag(s) to inventory${toCreate[0] ? ` starting ${toCreate[0]}` : ""}`,
    });

    return NextResponse.json({ created: toCreate.length, skipped: cleanList.length - toCreate.length });
  } catch {
    return NextResponse.json({ error: "Failed to add baggage tags" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { numbers } = await req.json();
    const cleanList = Array.isArray(numbers)
      ? Array.from(new Set(numbers.map((tag) => cleanTag(String(tag))).filter(Boolean)))
      : [];
    if (cleanList.length === 0) {
      return NextResponse.json({ error: "Select at least one baggage tag to delete" }, { status: 400 });
    }

    const assigned = await prisma.baggageTag.findMany({
      where: { tagNumber: { in: cleanList }, status: { not: "AVAILABLE" } },
      select: { tagNumber: true },
    });
    if (assigned.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete assigned tags (release them from the booking first): ${assigned.map((t) => t.tagNumber).join(", ")}` },
        { status: 400 }
      );
    }

    const result = await prisma.baggageTag.deleteMany({
      where: { tagNumber: { in: cleanList }, status: "AVAILABLE" },
    });

    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entity: "BaggageTag",
      entityId: cleanList[0] ?? "",
      details: `Removed ${result.count} baggage tag(s) from inventory starting ${cleanList[0] ?? ""}`,
    });

    return NextResponse.json({ deleted: result.count });
  } catch {
    return NextResponse.json({ error: "Failed to delete baggage tags" }, { status: 500 });
  }
}