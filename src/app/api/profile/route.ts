import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true, totpEnabled: true, profilePic: true },
  });
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { name, profilePic } = body as { name?: string; profilePic?: string | null };

    const data: Record<string, unknown> = {};
    if (typeof name === "string") {
      const trimmed = name.trim();
      if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      if (trimmed.length > 80) return NextResponse.json({ error: "Name too long" }, { status: 400 });
      data.name = trimmed;
    }
    if (profilePic !== undefined) {
      if (profilePic === null || profilePic === "") {
        data.profilePic = null;
      } else if (typeof profilePic === "string") {
        const val = profilePic.trim();
        // Allow data:image/*;base64,... or https://... (stored as URL). Limit 2.5MB base64 (~3.4M chars) to keep DB healthy.
        if (val.length > 3_500_000) {
          return NextResponse.json({ error: "Image too large (max ~2.5MB)" }, { status: 400 });
        }
        const isDataUrl = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(val);
        const isHttps = /^https:\/\/[^\s"']+$/.test(val);
        if (!isDataUrl && !isHttps) {
          return NextResponse.json({ error: "Invalid image format. Use PNG/JPEG/WEBP as data URL or https URL" }, { status: 400 });
        }
        data.profilePic = val;
      } else {
        return NextResponse.json({ error: "Invalid profile picture" }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, name: true, email: true, role: true, profilePic: true },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
