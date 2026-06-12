import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
    },
  });

  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const existing = await prisma.customer.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
