import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        include: {
          location: { select: { name: true, city: true } },
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
      },
    });

    return NextResponse.json(customer);
  } catch {
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
