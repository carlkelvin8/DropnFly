"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import { PackageOpen, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AssignedBooking {
  id: string;
  phase: string;
  booking: {
    id: string;
    referenceNumber: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    numberOfBags: number;
    checkIn: string;
    checkOut: string | null;
    customer: { name: string };
    baggageTags: { tagNumber: string }[];
  };
}

interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  details: string | null;
  createdAt: string;
}

export default function TrackingDashboardPage() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<AssignedBooking[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const abort = new AbortController();
    fetch(`/api/employees/${session.user.id}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => {
        if (abort.signal.aborted) return;
        setAssignments(data.assignedBookings || []);
        setActivityHistory(data.activityHistory || []);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [session]);

  const pickup = assignments.filter((a) => a.phase === "PICKUP");
  const dropoff = assignments.filter((a) => a.phase !== "PICKUP");

  const tags = (a: AssignedBooking) =>
    a.booking.baggageTags.map((t) => t.tagNumber).join(", ") || "—";

  const renderTable = (rows: AssignedBooking[], colSpan: number) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Baggage Tag</TableHead>
          <TableHead>Pickup</TableHead>
          <TableHead>Drop-off</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs">
              {a.booking.referenceNumber}
            </TableCell>
            <TableCell className="font-medium">
              {a.booking.customer.name}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {tags(a)}
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
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
              No bookings assigned to you yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tracking Dashboard</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4 text-blue-600" />
            Pickup Bookings ({pickup.length})
          </CardTitle>
        </CardHeader>
        <CardContent>{renderTable(pickup, 7)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4 text-blue-600" />
            Drop-off Bookings ({dropoff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>{renderTable(dropoff, 7)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-blue-600" />
            My Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityHistory.length > 0 ? (
            <div className="space-y-2">
              {activityHistory.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {h.action}
                    </span>
                    <span className="text-xs">{h.details || h.entity}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString("en-PH")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No activity recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
