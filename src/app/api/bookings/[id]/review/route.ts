import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const customer = await getCustomerSession();
  if (!session?.user && !customer) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const review = await prisma.bookingReview.findUnique({
    where: { bookingId: id },
    include: { customer: { select: { name: true } } },
  });
  return NextResponse.json(review);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerSession();
  if (!customer) return new NextResponse("Unauthorized", { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== customer.id) return new NextResponse("Forbidden", { status: 403 });
  if (booking.status !== "DELIVERED") return new NextResponse("Can only review completed bookings", { status: 400 });

  const existing = await prisma.bookingReview.findUnique({ where: { bookingId: id } });
  if (existing) return new NextResponse("Already reviewed", { status: 409 });

  const { rating, comment } = await req.json();
  if (!rating || rating < 1 || rating > 5) return new NextResponse("Rating must be 1-5", { status: 400 });

  const review = await prisma.bookingReview.create({
    data: { bookingId: id, customerId: customer.id, rating, comment: comment || null },
  });

  return NextResponse.json(review, { status: 201 });
}
