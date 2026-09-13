import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeReference } from "@/lib/utils";
import { canAccessBooking, canCustomerAccessBooking } from "@/lib/booking-access";
import { canReadBooking } from "@/lib/staff-access";

const STAFF_ROLES = ["ADMIN", "STAFF", "EMPLOYEE"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    select: { id: true, customerId: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await auth();
  const staffViewer = new URL(_req.url).searchParams.get("viewer") === "staff";
  if (staffViewer && !(session?.user && (STAFF_ROLES as readonly string[]).includes(session.user.role))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (staffViewer && session?.user && !(await canReadBooking(session.user, booking.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!staffViewer && !(await canCustomerAccessBooking(booking))) return NextResponse.json({ error: "Open this chat using customer booking access, or use the employee map." }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  await prisma.chatMessage.updateMany({
    where: { bookingId: booking.id, senderId: staffViewer ? null : { not: null }, isRead: false },
    data: { isRead: true },
  });

  // Sender identity is authoritative. This repairs the presentation of legacy
  // rows that were incorrectly saved with isFromCustomer=true by an employee.
  return NextResponse.json(messages.map((message) => ({
    ...message,
    isFromCustomer: message.senderId ? false : true,
  })));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    select: { id: true, customerId: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json();
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return NextResponse.json({ error: "Message must be between 1 and 2000 characters" }, { status: 400 });
  }

  // A logged-in staff/employee replying from this tracker chat must never be
  // saved as the customer (avoids the opposite-role bubble bug).
  const session = await auth();
  const staffViewer = new URL(req.url).searchParams.get("viewer") === "staff";
  if (staffViewer && !(session?.user && (STAFF_ROLES as readonly string[]).includes(session.user.role))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (staffViewer && session?.user && !(await canReadBooking(session.user, booking.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (staffViewer && session?.user) {
    const msg = await prisma.chatMessage.create({
      data: {
        bookingId: booking.id,
        senderId: session.user.id,
        message: message.trim(),
        isFromCustomer: false,
      },
    });
    return NextResponse.json(msg, { status: 201 });
  }

  if (!(await canCustomerAccessBooking(booking))) return NextResponse.json({ error: "Customer booking access required" }, { status: 403 });
  const msg = await prisma.chatMessage.create({
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      message: message.trim(),
      isFromCustomer: true,
    },
  });

  return NextResponse.json(msg, { status: 201 });
}
