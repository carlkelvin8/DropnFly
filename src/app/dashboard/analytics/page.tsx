"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  BarChart3,
  CalendarIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Overview {
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  averagePrice: number;
  averageBags: number;
  totalCustomers: number;
  newCustomers: number;
  storageUtilization: number;
}

interface StatusCount {
  status: string;
  count: number;
}

interface DayData {
  date: string;
  count: number;
  revenue: number;
}

interface HourData {
  hour: number;
  count: number;
}

interface EmployeePerf {
  userId: string;
  name: string;
  email: string;
  totalAssigned: number;
  lastAssigned: string;
}

interface LocationStats {
  name: string;
  capacity: number;
  used: number;
  utilization: number;
}

interface Analytics {
  overview: Overview;
  bookingsByStatus: StatusCount[];
  bookingsByDay: DayData[];
  revenueByStatus: { status: string; revenue: number }[];
  hourlyDistribution: HourData[];
  employeePerformance: EmployeePerf[];
  storageLocations: LocationStats[];
  bookingFrequency: { daily: number; period: string; fromDate?: string; toDate?: string };
  customerTrends: {
    totalCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    returnRate: number;
  };
}

const statusDot: Record<string, string> = {
  PENDING: "bg-yellow-500",
  CONFIRMED: "bg-blue-500",
  RECEIVED: "bg-purple-500",
  IN_STORAGE: "bg-indigo-500",
  OUT_FOR_DELIVERY: "bg-orange-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (period === "custom") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    fetch(`/api/analytics?${params.toString()}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((json) => { if (!abort.signal.aborted) setData(json); })
      .catch(() => {});
    return () => abort.abort();
  }, [period, dateFrom, dateTo]);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  const { overview, bookingsByDay, hourlyDistribution, employeePerformance, customerTrends } = data;
  const maxDailyCount = Math.max(...bookingsByDay.map((d) => d.count), 1);
  const maxHourlyCount = Math.max(...hourlyDistribution.map((h) => h.count), 1);
  const maxEmployee = Math.max(...employeePerformance.map((e) => e.totalAssigned), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {["week", "month", "year", "custom"].map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className={period === p ? "" : "text-muted-foreground hover:text-foreground"}
                >
                  {p === "custom" ? "Custom" : p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            )}
          </div>
          <Button variant="default" size="sm" asChild>
            <Link href="/dashboard/analytics/predictions">
              <TrendingUp className="mr-1 h-4 w-4" />
              Predictions
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-2 border-t-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {overview.activeBookings} active
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overview.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {formatCurrency(overview.averagePrice)} per booking
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-violet-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
              <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {overview.newCustomers} new this {period}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Storage Utilization
            </CardTitle>
            <div className="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
              <BarChart3 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.storageUtilization.toFixed(1)}%
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                style={{ width: `${Math.min(overview.storageUtilization, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Bookings Over Time */}
        <Card className="border-t-2 border-t-blue-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Bookings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] rounded-lg bg-muted/20 p-2" style={{ height: 160 }}>
              {bookingsByDay.slice(-30).map((day, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-blue-400 transition-all hover:from-blue-700 hover:to-blue-500"
                  style={{
                    height: `${(day.count / maxDailyCount) * 100}%`,
                    minHeight: day.count > 0 ? 4 : 0,
                  }}
                  title={`${day.date}: ${day.count} bookings (${formatCurrency(day.revenue)})`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Last {bookingsByDay.length} days &middot;{" "}
              {data.bookingFrequency.daily.toFixed(1)} avg per day
            </p>
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card className="border-t-2 border-t-emerald-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Peak Booking Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] rounded-lg bg-muted/20 p-2" style={{ height: 160 }}>
              {hourlyDistribution.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all hover:from-emerald-700 hover:to-emerald-500"
                  style={{
                    height: `${(h.count / maxHourlyCount) * 100}%`,
                    minHeight: h.count > 0 ? 4 : 0,
                  }}
                  title={`${h.hour}:00 - ${h.count} bookings`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Employee Performance */}
        <Card className="border-t-2 border-t-violet-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Employee Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {employeePerformance.slice(0, 5).map((emp, i) => (
              <div key={emp.userId} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{emp.name}</span>
                    <span className="font-semibold text-muted-foreground">
                      {emp.totalAssigned}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                      style={{
                        width: `${(emp.totalAssigned / maxEmployee) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {employeePerformance.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Trends */}
        <Card className="border-t-2 border-t-amber-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Customer Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-bold">{customerTrends.totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-2xl font-bold">
                  {customerTrends.returnRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Return Rate</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold">{customerTrends.newCustomers}</p>
                <p className="text-xs text-muted-foreground">New (this period)</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-2xl font-bold">
                  {customerTrends.repeatCustomers}
                </p>
                <p className="text-xs text-muted-foreground">Repeat Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Status Breakdown */}
      <Card className="border-t-2 border-t-indigo-500">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Booking Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.bookingsByStatus.map((s) => (
              <Badge
                key={s.status}
                variant="secondary"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
              >
                <span className={`h-2 w-2 rounded-full ${statusDot[s.status] || "bg-gray-400"}`} />
                {s.status.replace(/_/g, " ")}
                <span className="ml-0.5 rounded-full bg-background px-2 py-0.5 text-xs font-bold">
                  {s.count}
                </span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
