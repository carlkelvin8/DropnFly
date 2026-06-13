import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, setCustomerCookie } from "@/lib/customer-auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { email } });

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

    const token = await signCustomerToken({ id: customer.id, email: customer.email, name: customer.name });
    await setCustomerCookie(token);

    return NextResponse.json({
      success: true,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    });
  } catch (error) {
    console.error("Customer login error:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
