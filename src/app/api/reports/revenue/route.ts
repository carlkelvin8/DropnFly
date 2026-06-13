import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
  }

  const payments = await prisma.payment.findMany({
    where: { ...where, status: "PAID" },
    include: { booking: { select: { referenceNumber: true } }, customer: { select: { name: true, email: true } } },
    orderBy: { paidAt: "desc" },
  });

  const header = "Reference,Customer,Email,Amount,Method,Paid At\n";
  const rows = payments.map((p) =>
    [
      p.booking.referenceNumber,
      escapeCsv(p.customer.name),
      p.customer.email,
      p.amount,
      p.method,
      p.paidAt?.toISOString() || "",
    ].join(",")
  ).join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="revenue-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function escapeCsv(val: string) {
  return `"${val.replace(/"/g, '""')}"`;
}
