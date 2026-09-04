import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const includeLocation = new URL(req.url).searchParams.get("includeLocation") === "true";
    if (includeLocation && !["ADMIN", "STAFF"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const riders = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true, isApproved: true },
      select: includeLocation
        ? { id: true, name: true, email: true, role: true, currentLat: true, currentLng: true, lastLocationUpdate: true }
        : { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(riders);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Riders error:", error);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
