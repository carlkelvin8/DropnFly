import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signFeedbackAccess } from "@/lib/feedback-access";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { normalizeScannedReference } from "@/lib/scan-reference";
import { getSystemSettings, setting } from "@/lib/settings";

export async function POST(request: Request) {
  const limited = await rateLimit(`feedback-access:${requestKey(request)}`, 10, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === "string"
    ? normalizeScannedReference(body.reference).slice(0, 80)
    : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!reference || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Transaction number and booking email are required." }, { status: 400 });
  }

  const settings = await getSystemSettings();
  if (setting(settings, "customer_reviews_enabled", "true") === "false") {
    return NextResponse.json({ error: "Customer feedback is currently unavailable." }, { status: 403 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      referenceNumber: reference,
      OR: [
        { customer: { email: { equals: email, mode: "insensitive" } } },
        { customerEmailSnapshot: { equals: email, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      customerId: true,
      referenceNumber: true,
      status: true,
      checkOut: true,
      updatedAt: true,
      createdAt: true,
      review: { select: { id: true, rating: true, comment: true, createdAt: true } },
    },
  });

  // Keep the response generic so it does not reveal which credential was wrong.
  if (!booking) {
    return NextResponse.json({ error: "Transaction number and email do not match." }, { status: 404 });
  }
  if (booking.status !== "DELIVERED") {
    return NextResponse.json(
      { error: "Feedback becomes available after the transaction is marked delivered." },
      { status: 409 },
    );
  }

  const accessToken = await signFeedbackAccess({ bookingId: booking.id, customerId: booking.customerId });
  return NextResponse.json({
    accessToken,
    booking: {
      referenceNumber: booking.referenceNumber,
      completionDate: booking.checkOut || booking.updatedAt || booking.createdAt,
    },
    review: booking.review,
  });
}
