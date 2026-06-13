"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LocationUpdater } from "@/components/tracking/LocationUpdater";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Navigation } from "lucide-react";
import Link from "next/link";

interface AssignedBooking {
  booking: {
    id: string;
    referenceNumber: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    customer: { name: string };
  };
}

export default function MyDashboardPage() {
  const { data: session } = useSession();
  const [tracking, setTracking] = useState(false);
  const [assignments, setAssignments] = useState<AssignedBooking[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const abort = new AbortController();
    fetch(`/api/employees/${session.user.id}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setAssignments(data.assignedBookings || []); })
      .catch(() => {});
    return () => abort.abort();
  }, [session]);

  return (
    <div className="space-y-6">
      <LocationUpdater enabled={tracking} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <Button
          variant={tracking ? "default" : "outline"}
          onClick={() => setTracking(!tracking)}
        >
          <Navigation className={`mr-2 h-4 w-4 ${tracking ? "animate-pulse" : ""}`} />
          {tracking ? "Sharing Location" : "Share Location"}
        </Button>
      </div>

      {tracking && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
            <p className="text-sm text-green-800">
              Your location is being shared in real-time. Customers can see your
              position on the live map.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Assigned Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Drop-off</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.booking.id}>
                  <TableCell className="font-mono text-xs">
                    {a.booking.referenceNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.booking.customer.name}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {a.booking.pickupLocation}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {a.booking.dropOffLocation}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {a.booking.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/bookings/${a.booking.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No bookings assigned to you yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
