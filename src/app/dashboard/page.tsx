"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { KPISkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Package,
  Warehouse,
  Inbox,
  CheckCircle2,
  Users,
  CalendarDays,
  Clock,
  Truck,
  Timer,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import Link from "next/link";

interface DashboardData {
  capacityUsage: { used: number; total: number; percent: number };
  bookingsThisMonth: number;
  claimedThisMonth: number;
  completionRate: number;
  totalUsers: number;
  totalBookings: number;
  deliveredBookings: number;
  pendingDeliveries: number;
  outForDelivery: number;
  avgDeliveryTimeHours: number;
  durationBuckets: Record<string, number>;
  bagDistribution: Record<string, number>;
}

interface DayActivity {
  bookings: { referenceNumber: string; status: string; checkIn: string; checkOut: string; createdAt: string; numberOfBags: number }[];
  activities: { action: string; entity: string; createdAt: string }[];
}

const BAG_COLORS: Record<string, string> = {
  "Extra Small": "#10b981",
  Small: "#3b82f6",
  Standard: "#8b5cf6",
  Large: "#f59e0b",
};
const BAG_FALLBACK_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dayActivity, setDayActivity] = useState<DayActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [activeDates, setActiveDates] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setData)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const fetchDayActivity = useCallback(async (date: string) => {
    if (!date) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/dashboard/calendar?date=${date}`);
      if (!res.ok) throw new Error();
      setDayActivity(await res.json());
    } catch {
      setDayActivity(null);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDayActivity(selectedDate);
  }, [selectedDate, fetchDayActivity]);

  useEffect(() => {
    fetch(`/api/dashboard/calendar/month?year=${calYear}&month=${calMonth}`)
      .then((r) => r.json())
      .then((d) => setActiveDates(d.activeDates || {}))
      .catch(() => setActiveDates({}));
  }, [calYear, calMonth]);

  function prevMonth() {
    if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dateKey(day: number) {
    return `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function isToday(day: number) {
    return calYear === now.getFullYear() && calMonth === now.getMonth() + 1 && day === now.getDate();
  }

  if (loading && !data) return <KPISkeleton />;
  if (!data) return <div className="text-center text-muted-foreground">Failed to load dashboard</div>;

  const durationData = Object.entries(data.durationBuckets).map(([name, value]) => ({ name, value }));
  const bagData = Object.entries(data.bagDistribution).map(([name, value]) => ({ name, value }));

  const durationLabelMap: Record<string, string> = {
    "0-1": "0-1 days",
    "2-3": "2-3 days",
    "4-7": "4-7 days",
    "8-14": "8-14 days",
    "15+": "15+ days",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">System overview at a glance</p>
        </div>
      </div>

      {/* Primary KPIs - 4 columns */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-2 border-t-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Capacity</CardTitle>
            <div className="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
              <Warehouse className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.capacityUsage.percent}%</div>
            <p className="text-xs text-muted-foreground">{data.capacityUsage.used} of {data.capacityUsage.total} slots used</p>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${data.capacityUsage.percent}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bookings (This Month)</CardTitle>
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.bookingsThisMonth}</div>
            <p className="text-xs text-muted-foreground">Total: {data.totalBookings}</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <Inbox className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.deliveredBookings}</div>
            <p className="text-xs text-muted-foreground">{data.claimedThisMonth} this month</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Deliveries</CardTitle>
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
              <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingDeliveries + data.outForDelivery}</div>
            <p className="text-xs text-muted-foreground">{data.outForDelivery} out for delivery</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs - 3 columns */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card className="border-t-2 border-t-violet-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Delivery Time</CardTitle>
            <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
              <Timer className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.avgDeliveryTimeHours >= 24
                ? `${(data.avgDeliveryTimeHours / 24).toFixed(1)}d`
                : `${data.avgDeliveryTimeHours.toFixed(1)}h`}
            </div>
            <p className="text-xs text-muted-foreground">Check-in to delivery</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
              <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.completionRate}%</div>
            <p className="text-xs text-muted-foreground">{data.deliveredBookings} of {data.totalBookings}</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Link href="/dashboard/tracking">
            <Card className="border-t-2 border-t-rose-500 cursor-pointer transition-shadow hover:shadow-md h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Route Playback</CardTitle>
                <div className="rounded-lg bg-rose-100 p-2 dark:bg-rose-900/30">
                  <MapPin className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalUsers}</div>
                <p className="text-xs text-muted-foreground">View rider history</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold">
                {new Date(calYear, calMonth - 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
              </p>
              <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const key = dateKey(day);
                const count = activeDates[key] || 0;
                const hasActivity = count > 0;
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(key)}
                    className={`relative flex h-9 w-full items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md"
                        : hasActivity
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold"
                          : "text-gray-600 hover:bg-muted"
                    } ${isToday(day) && !isSelected ? "ring-2 ring-blue-400" : ""}`}
                  >
                    {day}
                    {hasActivity && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" /> Has bookings
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded ring-2 ring-blue-400" /> Today
              </span>
            </div>

            {/* Day detail */}
            <div className="mt-4 border-t pt-4">
              {activityLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : dayActivity ? (
                <div className="space-y-3 max-h-[240px] overflow-y-auto">
                  {dayActivity.bookings.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Bookings ({dayActivity.bookings.length})</p>
                      <div className="space-y-1">
                        {dayActivity.bookings.map((b, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border bg-card px-3 py-1.5 text-sm">
                            <span className="font-mono text-xs">{b.referenceNumber}</span>
                            <span className="text-xs text-muted-foreground">{b.numberOfBags} bag{b.numberOfBags > 1 ? "s" : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {dayActivity.activities.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Activities ({dayActivity.activities.length})</p>
                      <div className="space-y-1">
                        {dayActivity.activities.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">{a.action}</span>
                            <span className="text-xs">{a.entity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {dayActivity.bookings.length === 0 && dayActivity.activities.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">No activity on this date</p>
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">Select a date to view details</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Storage Duration Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Storage Duration Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {durationData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={durationData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        formatter={(value, _name, props) => [
                          `${value} booking${Number(value) !== 1 ? "s" : ""}`,
                          `Duration: ${props?.payload ? durationLabelMap[props.payload.name] || props.payload.name : ""}`,
                        ]}
                        labelFormatter={(label) => `Storage: ${durationLabelMap[label as string] || label}`}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-[11px] text-muted-foreground text-center">
                    Distribution of luggage storage durations across all delivered bookings.
                  </p>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Bag Size Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Bag Size Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bagData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(140, bagData.length * 40)}>
                    <BarChart data={bagData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={90}
                      />
                      <Tooltip
                        formatter={(value, _name, props) => [
                          `${value} bag${Number(value) !== 1 ? "s" : ""}`,
                          `Type: ${props?.payload?.name || ""}`,
                        ]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {bagData.map((entry, i) => (
                          <Cell key={i} fill={BAG_COLORS[entry.name] || BAG_FALLBACK_COLORS[i % BAG_FALLBACK_COLORS.length]} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(value) => {
                            const total = bagData.reduce((s, b) => s + b.value, 0);
                            const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
                            return `${value} (${pct}%)`;
                          }}
                          style={{ fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-[11px] text-muted-foreground text-center">
                    Breakdown of luggage by size type across all active bookings.
                  </p>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
