import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const assignments = await prisma.bookingAssignment.findMany({
    where: { bookingId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          currentLat: true,
          currentLng: true,
          lastLocationUpdate: true,
          profilePic: true,
          vehicleType: true,
          plateNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assignments);
}
