"use client";

import { useEffect, useState } from "react";
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
  CalendarDays,
  Clock,
  Truck,
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
  totalUsers: number;
  totalBookings: number;
  deliveredBookings: number;
  pendingDeliveries: number;
  outForDelivery: number;
  bookingsThisWeek: number;
  bookingsToday: number;
  deliveredToday: number;
  deliveredThisWeek: number;
  completionRateWeekly: number;
  pendingToday: number;
  durationBuckets: Record<string, number>;
  bagDistribution: Record<string, number>;
}

interface DayActivity {
  bookings: { referenceNumber: string; status: string; checkIn: string; checkOut: string; createdAt: string; numberOfBags: number }[];
}

const BAG_COLORS: Record<string, string> = {
  "Extra Small": "#d1d5db",
  Small: "#3b7ac7",
  Standard: "#ea7d3d",
  Large: "#9ca3af",
};
const BAG_FALLBACK_COLORS = ["#ea7d3d", "#3b7ac7", "#9ca3af", "#e3f0fb"];
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
  const [selectedDate, setSelectedDate] = useState("");
  const [dayActivity, setDayActivity] = useState<DayActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setData)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  function openDay(date: string) {
    if (!date) return;
    setSelectedDate(date);
    setDayActivity(null);
    setActivityLoading(true);
    fetch(`/api/dashboard/calendar?date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setDayActivity(data))
      .catch(() => setDayActivity(null))
      .finally(() => setActivityLoading(false));
  }

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Bookings (This Week)</CardTitle>
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.bookingsThisWeek}</div>
            <p className="text-xs text-muted-foreground">{data.bookingsToday} scheduled today</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed (Today)</CardTitle>
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <Inbox className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.deliveredToday}</div>
            <p className="text-xs text-muted-foreground">{data.deliveredThisWeek} this week</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Deliveries (Today)</CardTitle>
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
              <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingToday}</div>
            <p className="text-xs text-muted-foreground">{data.outForDelivery} out for delivery</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs - 2 columns */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card className="border-t-2 border-t-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate (This Week)</CardTitle>
            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
              <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.completionRateWeekly}%</div>
            <p className="text-xs text-muted-foreground">{data.deliveredThisWeek} of {data.bookingsThisWeek} delivered</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Link href="/dashboard/logistics">
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
              <button onClick={prevMonth} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold">
                {new Date(calYear, calMonth - 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
              </p>
              <button onClick={nextMonth} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
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
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={key}
                    onClick={() => openDay(key)}
                    className={`relative flex h-9 w-full items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-orange-500 text-white shadow-md"
                        : "text-muted-foreground hover:bg-muted"
                    } ${isToday(day) && !isSelected ? "ring-2 ring-blue-400" : ""}`}
                  >
                    {day}
                    <span className="sr-only">Open day details</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>Details remain hidden until a date is intentionally opened.</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded ring-2 ring-blue-400" /> Today
              </span>
            </div>

          </CardContent>
        </Card>

        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="calendar-detail-title" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedDate(""); }}>
            <Card className="w-full max-w-lg shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle id="calendar-detail-title">Schedule details</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "long" })}</p>
                </div>
                <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setSelectedDate("")} aria-label="Close schedule details">×</button>
              </CardHeader>
              <CardContent>
              {activityLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading details...</p> : dayActivity ? (
                <div className="max-h-[60vh] space-y-3 overflow-y-auto">
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
                  {dayActivity.bookings.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No bookings scheduled on this date</p>
                  )}
                </div>
              ) : <p className="py-8 text-center text-sm text-muted-foreground">Unable to load schedule details</p>}
              </CardContent>
            </Card>
          </div>
        )}

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
                        contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" fill="#ea7d3d" radius={[4, 4, 0, 0]} />
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
                        contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
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
