import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { employeeSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isApproved: true,
      isActive: true,
      createdAt: true,
      _count: { select: { bookings: true, assignedBookings: true } },
    },
  });

  return NextResponse.json(employees);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const employee = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "EMPLOYEE",
        isApproved: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "User",
      entityId: employee.id,
      details: `Created employee account for ${name} (${email})`,
    });

    return NextResponse.json(employee, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
