import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, setCustomerCookie } from "@/lib/customer-auth";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const key = requestKey(req);
    const { allowed, retryAfter } = await rateLimit(`customer-login:${key}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { email: String(email).trim().toLowerCase() } });

    if (!customer || !customer.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, customer.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!customer.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }
    if (!customer.emailVerifiedAt) {
      return NextResponse.json({ error: "Verify your email before signing in" }, { status: 403 });
    }

    const token = await signCustomerToken({ id: customer.id, email: customer.email, name: customer.name, authVersion: customer.authVersion });
    await setCustomerCookie(token);

    return NextResponse.json({
      success: true,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Customer login error:", error);
    }
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
