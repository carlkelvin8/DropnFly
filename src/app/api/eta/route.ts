import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ETA Engine for DropnFly
 * Fixed route: NAIA <-> DropnFly Storage Hub
 * Calculates ETA based on:
 * - Current rider location (if available)
 * - Fixed route distance (~12km NAIA to typical Metro Manila hub)
 * - Average city speed (25 km/h with traffic, 35 km/h without)
 * - Time-of-day traffic factor
 */

// NAIA Terminal 1 approx coordinates
const NAIA_LAT = 14.5086;
const NAIA_LNG = 121.0194;

// DropnFly hub (Makati Main Branch) approx coordinates
const HUB_LAT = 14.5547;
const HUB_LNG = 121.0244;

const FIXED_ROUTE_DISTANCE_KM = 7.5; // Approx road distance NAIA -> Makati hub

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTrafficFactor(hour: number): number {
  // Rush hours: 7-9am, 5-8pm → slower
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) return 0.6;
  // Late night: faster
  if (hour >= 22 || hour <= 5) return 1.3;
  // Normal hours
  return 1.0;
}

function calculateETA(distanceKm: number, trafficFactor: number): { minutes: number; label: string } {
  const baseSpeedKmH = 30; // Metro Manila average
  const effectiveSpeed = baseSpeedKmH * trafficFactor;
  const minutes = Math.round((distanceKm / effectiveSpeed) * 60);

  let label: string;
  if (minutes <= 1) label = "1 min";
  else if (minutes < 60) label = `${minutes} mins`;
  else {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    label = remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  }

  return { minutes, label };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");
  const riderLat = parseFloat(searchParams.get("riderLat") || "0");
  const riderLng = parseFloat(searchParams.get("riderLng") || "0");
  const destType = searchParams.get("dest") || "hub"; // "hub" | "naia" | "customer"
  const destLat = parseFloat(searchParams.get("destLat") || "0");
  const destLng = parseFloat(searchParams.get("destLng") || "0");

  const now = new Date();
  const hour = now.getHours();
  const trafficFactor = getTrafficFactor(hour);

  // If reference provided, get rider from booking assignment
  let actualRiderLat = riderLat;
  let actualRiderLng = riderLng;

  if (reference && !riderLat && !riderLng) {
    const booking = await prisma.booking.findUnique({
      where: { referenceNumber: reference },
      select: { id: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const assignment = await prisma.bookingAssignment.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { currentLat: true, currentLng: true, lastLocationUpdate: true } },
      },
    });

    if (assignment?.user?.currentLat && assignment?.user?.currentLng) {
      actualRiderLat = assignment.user.currentLat;
      actualRiderLng = assignment.user.currentLng;
    }
  }

  // Determine destination
  let finalDestLat: number;
  let finalDestLng: number;
  let destName: string;

  if (destType === "naia") {
    finalDestLat = NAIA_LAT;
    finalDestLng = NAIA_LNG;
    destName = "NAIA";
  } else if (destType === "customer" && destLat && destLng) {
    finalDestLat = destLat;
    finalDestLng = destLng;
    destName = "Customer Location";
  } else {
    finalDestLat = HUB_LAT;
    finalDestLng = HUB_LNG;
    destName = "DropnFly Hub";
  }

  // Calculate distance
  let distanceKm: number;
  if (actualRiderLat && actualRiderLng) {
    // Use actual rider position
    distanceKm = haversine(actualRiderLat, actualRiderLng, finalDestLat, finalDestLng);
    // Apply road factor (roads aren't straight lines)
    distanceKm *= 1.35;
  } else {
    // Use fixed route distance as fallback
    distanceKm = FIXED_ROUTE_DISTANCE_KM;
  }

  const eta = calculateETA(distanceKm, trafficFactor);

  return NextResponse.json({
    eta: eta.label,
    etaMinutes: eta.minutes,
    distanceKm: Math.round(distanceKm * 100) / 100,
    destination: destName,
    trafficCondition: trafficFactor < 0.8 ? "heavy" : trafficFactor > 1.1 ? "light" : "moderate",
    riderLocation: actualRiderLat && actualRiderLng
      ? { lat: actualRiderLat, lng: actualRiderLng }
      : null,
    timestamp: now.toISOString(),
  });
}
