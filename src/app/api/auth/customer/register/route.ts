import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, setCustomerCookie } from "@/lib/customer-auth";

export async function POST(req: Request) {
  try {
    const { name, email, phone, password } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.customer.findUnique({ where: { email } });

    if (existing) {
      if (existing.password) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.customer.update({
        where: { email },
        data: { name, phone, password: hashedPassword },
      });
      const token = await signCustomerToken({ id: existing.id, email: existing.email, name: existing.name });
      await setCustomerCookie(token);
      return NextResponse.json({ success: true, customer: { id: existing.id, name: existing.name, email: existing.email } });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const customer = await prisma.customer.create({
      data: { name, email, phone, password: hashedPassword },
    });

    const token = await signCustomerToken({ id: customer.id, email: customer.email, name: customer.name });
    await setCustomerCookie(token);

    return NextResponse.json(
      { success: true, customer: { id: customer.id, name: customer.name, email: customer.email } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customer register error:", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
