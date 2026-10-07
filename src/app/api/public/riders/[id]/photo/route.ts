import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves an employee's profile photo as a normal image URL. Profile photos are stored as base64
// data URLs, which email clients block or clip, so emails link here instead of embedding them.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, role: "EMPLOYEE" },
    select: { profilePic: true },
  });
  const pic = user?.profilePic;
  if (!pic) return new NextResponse(null, { status: 404 });

  if (pic.startsWith("https://")) return NextResponse.redirect(pic, 302);

  const match = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(pic);
  if (!match || !ALLOWED_TYPES.has(match[1].toLowerCase())) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1].toLowerCase(),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
