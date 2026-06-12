import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "disconnected", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
