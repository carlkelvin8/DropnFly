import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decimalsToNumbers } from "@/lib/serialize";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "EMPLOYEE", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(decimalsToNumbers(promos));
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Promo codes error:", error);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "EMPLOYEE", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { code, description, type, value, maxUsage, minAmount, maxDiscount, expiresAt } = body;

    if (typeof code !== "string" || !code.trim() || !type || value == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length > 32 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(normalizedCode)) {
      return NextResponse.json({ error: "Code must use up to 32 letters, numbers, hyphens, or underscores" }, { status: 400 });
    }
    if (description != null && (typeof description !== "string" || description.length > 500)) {
      return NextResponse.json({ error: "Description must be 500 characters or fewer" }, { status: 400 });
    }
    if (!["PERCENTAGE", "FIXED"].includes(type)) {
      return NextResponse.json({ error: "Type must be PERCENTAGE or FIXED" }, { status: 400 });
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0 || (type === "PERCENTAGE" && numericValue > 100)) {
      return NextResponse.json({ error: type === "PERCENTAGE" ? "Percentage must be between 0 and 100" : "Value must be greater than 0" }, { status: 400 });
    }
    if (maxUsage != null && (!Number.isInteger(Number(maxUsage)) || Number(maxUsage) < 1)) {
      return NextResponse.json({ error: "Max usage must be a whole number of at least 1" }, { status: 400 });
    }
    for (const [label, amount] of [["Minimum amount", minAmount], ["Maximum discount", maxDiscount]] as const) {
      if (amount != null && amount !== "" && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
        return NextResponse.json({ error: `${label} must be zero or more` }, { status: 400 });
      }
    }
    if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }

    const existing = await prisma.promoCode.findUnique({ where: { code: normalizedCode } });
    if (existing) {
      return NextResponse.json({ error: "Promo code already exists" }, { status: 409 });
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: normalizedCode,
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        type,
        value: numericValue,
        maxUsage: maxUsage == null || maxUsage === "" ? 100 : Number(maxUsage),
        minAmount: minAmount == null || minAmount === "" ? 0 : Number(minAmount),
        maxDiscount: maxDiscount == null || maxDiscount === "" ? null : Number(maxDiscount),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json(decimalsToNumbers(promo), { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ error: "Promo code already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 });
  }
}
