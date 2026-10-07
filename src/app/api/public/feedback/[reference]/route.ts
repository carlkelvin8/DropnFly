import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyFeedbackAccess } from "@/lib/feedback-access";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { normalizeReference } from "@/lib/utils";
import { getSystemSettings, setting } from "@/lib/settings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const access = await verifyFeedbackAccess(request);
  if (!access) return NextResponse.json({ error: "Verification expired. Please verify again." }, { status: 401 });

  const limited = await rateLimit(
    `feedback-submit:${requestKey(request)}:${access.bookingId}`,
    5,
    60 * 60 * 1000,
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many submission attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const settings = await getSystemSettings();
  if (setting(settings, "customer_reviews_enabled", "true") === "false") {
    return NextResponse.json({ error: "Customer feedback is currently unavailable." }, { status: 403 });
  }

  const { reference } = await params;
  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    select: { id: true, customerId: true, status: true },
  });
  if (!booking || booking.id !== access.bookingId || booking.customerId !== access.customerId) {
    return NextResponse.json({ error: "Invalid feedback access." }, { status: 403 });
  }
  if (booking.status !== "DELIVERED") {
    return NextResponse.json({ error: "Only delivered transactions can be reviewed." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const rating = typeof body?.rating === "number" ? body.rating : Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be an integer from 1 to 5." }, { status: 400 });
  }
  if (body?.comment != null && typeof body.comment !== "string") {
    return NextResponse.json({ error: "Feedback message must be text." }, { status: 400 });
  }
  const rawComment = typeof body?.comment === "string" ? body.comment.trim() : "";
  if (rawComment.length > 2000) {
    return NextResponse.json({ error: "Feedback message must be 2000 characters or less." }, { status: 400 });
  }
  const comment = rawComment ? rawComment.replace(/<[^>]*>/g, "").slice(0, 2000) : null;

  try {
    const review = await prisma.bookingReview.create({
      data: { bookingId: booking.id, customerId: booking.customerId, rating, comment },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (
      error && typeof error === "object" && "code" in error
      && (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Feedback has already been submitted for this transaction." },
        { status: 409 },
      );
    }
    console.error("Public feedback submission failed:", error);
    return NextResponse.json({ error: "Unable to submit feedback." }, { status: 500 });
  }
}
