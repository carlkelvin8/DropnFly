import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import bcrypt from "bcryptjs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const isOwner = session.user.id === id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isApproved: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { bookings: true, assignedBookings: true } },
      assignedBookings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          phase: true,
          booking: {
            select: {
              id: true,
              referenceNumber: true,
              status: true,
              pickupLocation: true,
              dropOffLocation: true,
              numberOfBags: true,
              checkIn: true,
              checkOut: true,
              customer: { select: { name: true } },
              baggageTags: { select: { tagNumber: true } },
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activityHistory = await prisma.activityLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, entity: true, details: true, createdAt: true },
  });

  return NextResponse.json({ ...employee, activityHistory });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    if (body.password && String(body.password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const passwordHash = body.password ? await bcrypt.hash(String(body.password), 12) : undefined;

    const employee = await prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        email: body.email?.trim().toLowerCase() || undefined,
        password: passwordHash,
        isApproved: body.isApproved !== undefined ? body.isApproved : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        role: body.role || undefined,
        authVersion: (body.password || body.isApproved !== undefined || body.isActive !== undefined || body.role) ? { increment: 1 } : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        isActive: true,
      },
    });

    const changes: string[] = [];
    if (body.isApproved !== undefined) {
      changes.push(`approval ${body.isApproved ? "approved" : "unapproved"}`);
    }
    if (body.isActive !== undefined) {
      changes.push(`account ${body.isActive ? "activated" : "deactivated"}`);
    }
    if (body.role) {
      changes.push(`role changed to ${body.role}`);
    }
    if (body.name) changes.push("name updated");
    if (body.email) changes.push("username/email updated");
    if (body.password) changes.push("password reset");

    await logActivity({
      userId: session.user.id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      details: `Updated employee ${employee.name}: ${changes.join(", ")}`,
    });

    return NextResponse.json(employee);
  } catch {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({ where: { id }, select: { name: true } });
    if (!employee) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.bookingAssignment.deleteMany({ where: { userId: id } }),
      prisma.locationUpdate.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.activityLog.deleteMany({ where: { userId: id } }),
      prisma.pushSubscription.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entity: "User",
      entityId: id,
      details: `Deleted employee ${employee.name}`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
