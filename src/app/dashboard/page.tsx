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
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";

interface DashboardData {
  capacityUsage: { used: number; total: number; percent: number };
  bookingsThisMonth: number;
  claimedThisMonth: number;
  completionRate: number;
  totalUsers: number;
  totalBookings: number;
  deliveredBookings: number;
  durationBuckets: Record<string, number>;
  bagDistribution: Record<string, number>;
}

interface DayActivity {
  bookings: { referenceNumber: string; status: string; checkIn: string; checkOut: string; createdAt: string; numberOfBags: number }[];
  activities: { action: string; entity: string; createdAt: string }[];
}

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dayActivity, setDayActivity] = useState<DayActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

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

  if (loading && !data) return <KPISkeleton />;
  if (!data) return <div className="text-center text-muted-foreground">Failed to load dashboard</div>;

  const durationData = Object.entries(data.durationBuckets).map(([name, value]) => ({ name, value }));
  const bagData = Object.entries(data.bagDistribution).map(([name, value]) => ({ name, value }));
  const totalBagCount = bagData.reduce((s, b) => s + b.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">System overview at a glance</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Claimed Items (This Month)</CardTitle>
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <Inbox className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.claimedThisMonth}</div>
            <p className="text-xs text-muted-foreground">Delivered this month</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-violet-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Transactions</CardTitle>
            <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
              <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.completionRate}%</div>
            <p className="text-xs text-muted-foreground">{data.deliveredBookings} of {data.totalBookings} completed</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="border-t-2 border-t-amber-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Registered staff &amp; admins</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4" />
              Day Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mb-4 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
            {activityLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : dayActivity ? (
              <div className="space-y-4 max-h-[320px] overflow-y-auto">
                {dayActivity.bookings.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Bookings</p>
                    <div className="space-y-1.5">
                      {dayActivity.bookings.map((b, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
                          <span className="font-mono text-xs">{b.referenceNumber}</span>
                          <span className="text-xs text-muted-foreground">{b.numberOfBags} bag{b.numberOfBags > 1 ? "s" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dayActivity.activities.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Activities</p>
                    <div className="space-y-1.5">
                      {dayActivity.activities.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">{a.action}</span>
                          <span className="text-xs">{a.entity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dayActivity.bookings.length === 0 && dayActivity.activities.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No activity on this date</p>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Select a date to view activity</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Storage Duration Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {durationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={durationData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Bag Size Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bagData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={bagData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={45}>
                        {bagData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                        <LabelList dataKey="value" position="center" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 text-sm">
                    {bagData.map((b, i) => (
                      <div key={b.name} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{b.name}</span>
                        <span className="font-medium">{Math.round((b.value / totalBagCount) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
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
