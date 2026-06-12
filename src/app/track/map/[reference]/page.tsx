"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveMap } from "@/components/tracking/LiveMap";
import { ChevronLeft, Navigation, Clock, MapPin, Map } from "lucide-react";

interface TrackingData {
  booking: {
    referenceNumber: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    checkIn: string;
  };
  assignments: {
    user: {
      id: string;
      name: string;
      currentLat: number | null;
      currentLng: number | null;
      lastLocationUpdate: string | null;
    };
  }[];
}

export default function LiveTrackingPage() {
  const params = useParams();
  const [data, setData] = useState<TrackingData | null>(null);
  const [employeeLoc, setEmployeeLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/bookings/${params.reference}`)
      .then((r) => {
        if (!r.ok) throw new Error("Booking not found");
        return r.json();
      })
      .then(async (booking) => {
        const assignmentsRes = await fetch(`/api/bookings/${booking.id}/assignments`);
        if (!assignmentsRes.ok) throw new Error("Failed to load assignments");
        const assignments = await assignmentsRes.json();
        if (cancelled) return;
        setData({ booking, assignments });

        if (assignments.length > 0) {
          const emp = assignments[0].user;
          if (emp.currentLat && emp.currentLng) {
            setEmployeeLoc({ lat: emp.currentLat, lng: emp.currentLng });
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [params.reference]);

  useEffect(() => {
    if (!data?.assignments?.[0]) return;

    const userId = data.assignments[0].user.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tracking/location/${userId}`);
        if (!res.ok) return;
        const loc = await res.json();
        if (loc.currentLat && loc.currentLng) {
          setEmployeeLoc({ lat: loc.currentLat, lng: loc.currentLng });
        }
      } catch {
        // silently retry on next tick
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [data]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading tracking data...</p>
      </div>
    );
  }

  const employee = data.assignments?.[0]?.user;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Dropnfly
            </span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href={`/track/${params.reference}`} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back to Tracking
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 shadow-md shadow-blue-200">
            <Map className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-xl font-bold text-transparent">
              Live Tracking
            </h1>
            <p className="font-mono text-sm text-blue-700">{data.booking.referenceNumber}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border shadow-lg lg:col-span-2">
            <LiveMap
              referenceNumber={data.booking.referenceNumber}
              employeeLat={employeeLoc?.lat || null}
              employeeLng={employeeLoc?.lng || null}
              employeeName={employee?.name}
            />
          </div>

          <div className="space-y-4">
            <Card className="border-t-4 border-blue-500 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Navigation className="h-4 w-4 text-blue-600" />
                  Assigned Employee
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employee ? (
                  <div className="space-y-2">
                    <p className="font-medium">{employee.name}</p>
                    {employeeLoc ? (
                      <Badge variant="success" className="shadow-sm">
                        <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-green-500" />
                        Moving
                      </Badge>
                    ) : (
                      <Badge variant="warning">Waiting for location</Badge>
                    )}
                    {employee.lastLocationUpdate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Updated {new Date(employee.lastLocationUpdate).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No employee assigned yet</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-t-4 border-indigo-500 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-indigo-500" />
                  Locations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border bg-gray-50/50 p-3">
                  <p className="text-muted-foreground">Pickup</p>
                  <p className="font-medium">{data.booking.pickupLocation}</p>
                </div>
                <div className="rounded-lg border bg-gray-50/50 p-3">
                  <p className="text-muted-foreground">Drop-off</p>
                  <p className="font-medium">{data.booking.dropOffLocation}</p>
                </div>
                <div className="rounded-lg border bg-gray-50/50 p-3">
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="secondary">
                    {data.booking.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
