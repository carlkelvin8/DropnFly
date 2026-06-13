"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KPISkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Package,
  Users,
  DollarSign,
  UserCheck,
  Warehouse,
  Inbox,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  stats: {
    totalLocations: number;
    totalBookings: number;
    activeBookings: number;
    totalCustomers: number;
    totalEmployees: number;
    pendingApprovals: number;
    totalRevenue: number;
  };
  recentBookings: {
    id: string;
    referenceNumber: string;
    customer: { name: string };
    pickupLocation: string;
    status: string;
    totalPrice: number;
    createdAt: string;
  }[];
  recentActivities: {
    id: string;
    action: string;
    entity: string;
    user: { name: string } | null;
    createdAt: string;
  }[];
  capacityUsage: { used: number; total: number };
}

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  CONFIRMED: "secondary",
  RECEIVED: "default",
  IN_STORAGE: "default",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

const statusDot: Record<string, string> = {
  PENDING: "bg-yellow-500",
  CONFIRMED: "bg-blue-500",
  RECEIVED: "bg-purple-500",
  IN_STORAGE: "bg-indigo-500",
  OUT_FOR_DELIVERY: "bg-orange-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const actionColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  CREATE: "success",
  UPDATE: "default",
  DELETE: "destructive",
  ASSIGN: "secondary",
  LOGIN: "outline",
  LOGOUT: "outline",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setData)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return <KPISkeleton />;
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">Failed to load dashboard</div>;
  }

  const usagePercent = data.capacityUsage.total > 0
    ? Math.round((data.capacityUsage.used / data.capacityUsage.total) * 100)
    : 0;

  const statsCards = [
    { title: "Total Bookings", value: data.stats.totalBookings, icon: Package, border: "border-t-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
    { title: "Active Bookings", value: data.stats.activeBookings, icon: Package, border: "border-t-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
    { title: "Total Customers", value: data.stats.totalCustomers, icon: Users, border: "border-t-violet-500", bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-400" },
    { title: "Total Employees", value: data.stats.totalEmployees, icon: UserCheck, border: "border-t-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/bookings/new">New Booking</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/locations/new">Add Location</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className={`border-t-2 ${stat.border}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg ${stat.bg} p-2`}>
                  <Icon className={`h-4 w-4 ${stat.text}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-t-2 border-t-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Storage Capacity Usage
            </CardTitle>
            <div className="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
              <Warehouse className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usagePercent}%</div>
            <p className="text-xs text-muted-foreground">
              {data.capacityUsage.used} of {data.capacityUsage.total} slots used
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.pendingApprovals} pending approvals
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-t-2 border-t-blue-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Reference</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentBookings.slice(0, 5).map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">
                      {booking.referenceNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.customer.name}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${statusDot[booking.status] || "bg-gray-400"}`} />
                        <Badge variant={statusVariant[booking.status] || "outline"} className="font-medium">
                          {booking.status.replace("_", " ")}
                        </Badge>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {data.recentBookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Inbox className="h-10 w-10" />
                        <p className="text-sm">No bookings yet</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-violet-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={actionColors[activity.action] || "outline"} className="font-medium">
                      {activity.action}
                    </Badge>
                    <span className="text-sm font-medium">{activity.entity}</span>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{activity.user?.name || "System"}</p>
                    <p>{formatDate(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
              {data.recentActivities.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
