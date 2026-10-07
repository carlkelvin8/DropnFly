import { NextResponse } from "next/server";
import { photoVersions, withPhotoUrl } from "@/lib/rider-photo";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { employeeSchema } from "@/lib/validations";

export async function GET(req: Request) {
  const session = await auth();
  const assignableOnly = new URL(req.url).searchParams.get("assignable") === "true";
  const canAssignBookings = session?.user && ["ADMIN", "STAFF"].includes(session.user.role);

  if (!session?.user || (assignableOnly ? !canAssignBookings : session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await prisma.user.findMany({
    where: assignableOnly
      ? { role: "EMPLOYEE", isActive: true, isApproved: true }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isApproved: true,
      isActive: true,
      createdAt: true,
      vehicleType: true,
      plateNumber: true,
      currentLat: true,
      currentLng: true,
      lastLocationUpdate: true,
      _count: { select: { bookings: true, assignedBookings: true } },
    },
  });

  const versions = await photoVersions(employees.map((employee) => employee.id));
  return NextResponse.json(employees.map((employee) => withPhotoUrl(employee, versions)));
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

    // Login looks accounts up by lowercase email, so store it that way.
    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const { password, role } = parsed.data;

    if (!name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
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
        passwordChangedAt: new Date(),
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
