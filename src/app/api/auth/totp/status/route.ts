import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json({ requiresTotp: false, valid: false }, { status: 200 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ requiresTotp: false, valid: false }, { status: 200 });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return NextResponse.json({ requiresTotp: false, valid: false }, { status: 200 });
    }
    if (!user.isApproved || !user.isActive) {
      return NextResponse.json({ requiresTotp: false, valid: false }, { status: 200 });
    }
    return NextResponse.json({
      valid: true,
      requiresTotp: user.totpEnabled === true,
    });
  } catch {
    return NextResponse.json({ requiresTotp: false, valid: false }, { status: 200 });
  }
}
