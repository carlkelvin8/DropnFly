import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { locationSchema } from "@/lib/validations";
import { hasStaffRole } from "@/lib/staff-access";
import { decimalsToNumbers } from "@/lib/serialize";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await prisma.storageLocation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(decimalsToNumbers(locations));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const location = await prisma.storageLocation.create({
      data: {
        name: body.name,
        address: body.address,
        city: body.city,
        capacity: parseInt(body.capacity),
        pricePerDay: parseFloat(body.pricePerDay),
        openingTime: body.openingTime || "08:00",
        closingTime: body.closingTime || "20:00",
      },
    });

    return NextResponse.json(decimalsToNumbers(location), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}
