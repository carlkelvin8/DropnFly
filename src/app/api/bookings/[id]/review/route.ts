import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { canReadBooking } from "@/lib/staff-access";
import { getSystemSettings, setting } from "@/lib/settings";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const customer = await getCustomerSession();
  if (!session?.user && !customer) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (customer && !session?.user) {
    const owned = await prisma.booking.findFirst({ where: { id, customerId: customer.id }, select: { id: true } });
    if (!owned) return new NextResponse("Forbidden", { status: 403 });
  }
  if (session?.user && !(await canReadBooking(session.user, id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const review = await prisma.bookingReview.findUnique({
    where: { bookingId: id },
    include: { customer: { select: { name: true } } },
  });
  return NextResponse.json(review);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const settings = await getSystemSettings();
  if (setting(settings, "customer_reviews_enabled", "true") === "false") {
    return NextResponse.json({ error: "Customer reviews are currently disabled" }, { status: 403 });
  }
  const { id } = await params;
  const customer = await getCustomerSession();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Validate booking exists and belongs to customer — do not trust frontend IDs
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (booking.customerId !== customer.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "DELIVERED") return NextResponse.json({ error: "Can only review completed bookings" }, { status: 400 });

  // Check existing review (frontend guard, but backend is authoritative)
  const existing = await prisma.bookingReview.findUnique({ where: { bookingId: id } });
  if (existing) return NextResponse.json({ error: "Thank you! Feedback has already been submitted for this transaction." }, { status: 409 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { rating, comment } = body as { rating?: unknown; comment?: unknown };

  // Strict rating validation 1-5 integer
  const numericRating = typeof rating === "string" ? parseInt(rating, 10) : rating;
  if (typeof numericRating !== "number" || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return NextResponse.json({ error: "Rating must be an integer from 1 to 5" }, { status: 400 });
  }

  // Review text sanitization/validation
  let sanitizedComment: string | null = null;
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== "string") return NextResponse.json({ error: "Review must be text" }, { status: 400 });
    const trimmed = comment.trim();
    if (trimmed.length > 2000) return NextResponse.json({ error: "Review must be 2000 characters or less" }, { status: 400 });
    // Basic sanitization: strip HTML tags and trim
    sanitizedComment = trimmed.length === 0 ? null : trimmed.replace(/<[^>]*>/g, "").slice(0, 2000);
  }

  try {
    const review = await prisma.bookingReview.create({
      data: { bookingId: id, customerId: customer.id, rating: numericRating, comment: sanitizedComment },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (e: unknown) {
    // Handle race condition: unique constraint violation on bookingId
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Thank you! Feedback has already been submitted for this transaction." }, { status: 409 });
    }
    console.error("Review creation failed:", e);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
