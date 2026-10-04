import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const where: Record<string, unknown> = { userId: session.user.id };
    if (unreadOnly) where.isRead = false;

    // `page` + `pageSize` enable server-side pagination; `limit` alone keeps the
    // original "latest N" behavior used by the header dropdown.
    const pageParam = parseInt(searchParams.get("page") || "");
    const paginated = Number.isFinite(pageParam) && pageParam > 0;
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "") || 10, 1), 50);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50") || 50, 1), 100);

    const total = paginated ? await prisma.notification.count({ where }) : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = paginated ? Math.min(pageParam, totalPages) : 1;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(paginated ? { skip: (page - 1) * pageSize, take: pageSize } : { take: limit }),
      }),
      prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    if (paginated) return NextResponse.json({ notifications, unreadCount, total, page, pageSize, totalPages });
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Notifications error:", error);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Notifications error:", error);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
