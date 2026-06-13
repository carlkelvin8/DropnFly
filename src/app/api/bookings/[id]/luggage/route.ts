import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function generateTagNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `BAG-${code}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const items = await prisma.luggageItem.findMany({
    where: { bookingId: id },
    orderBy: { checkInAt: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const tagNumber = generateTagNumber();

  const item = await prisma.luggageItem.create({
    data: {
      bookingId: id,
      tagNumber,
      description: body.description || null,
      location: body.location || null,
      status: "CHECKED_IN",
    },
  });

  return NextResponse.json(item, { status: 201 });
}
