import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: incidentId } = await params;

  try {
    const body = await req.json();
    const { action, description } = body;

    if (!action || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const timeline = await prisma.incidentTimeline.create({
      data: {
        incidentId,
        action,
        description,
        userId: session.user.id,
      },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json(timeline, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add timeline entry" }, { status: 500 });
  }
}
