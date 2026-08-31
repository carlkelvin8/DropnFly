"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  BarChart3,
  Brain,
  FileText,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import RechartsPie from "@/components/dashboard/RechartsPie";
import RechartsLine from "@/components/dashboard/RechartsLine";

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

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  booking: { referenceNumber: string };
  customer: { name: string; email: string };
}

type Tab = "overview" | "financial" | "reports";

const statusDot: Record<string, string> = {
  PENDING: "bg-yellow-500",
  CONFIRMED: "bg-blue-500",
  RECEIVED: "bg-purple-500",
  IN_STORAGE: "bg-indigo-500",
  OUT_FOR_DELIVERY: "bg-orange-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const tabs: { id: Tab; label: string; icon: typeof DollarSign }[] = [
  { id: "overview", label: "Graphical Data", icon: BarChart3 },
  { id: "financial", label: "Financial Oversight", icon: DollarSign },
  { id: "reports", label: "Reports", icon: FileText },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Analytics | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (period === "custom") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    fetch(`/api/analytics?${params.toString()}`, { signal: abort.signal, cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load analytics");
        return json;
      })
      .then((json) => { if (!abort.signal.aborted) { setData(json); setAnalyticsError(""); } })
      .catch((error) => { if (!abort.signal.aborted) setAnalyticsError(error instanceof Error ? error.message : "Failed to load analytics"); })
      .finally(() => { if (!abort.signal.aborted) setAnalyticsLoading(false); });
    return () => abort.abort();
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    if (tab !== "financial") return;
    const params = new URLSearchParams();
    const today = new Date();
    const days = period === "week" ? 7 : period === "year" ? 365 : 30;
    const effectiveFrom = period === "custom" ? dateFrom : new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
    const effectiveTo = period === "custom" ? dateTo : today.toISOString().slice(0, 10);
    if (effectiveFrom) params.set("from", effectiveFrom);
    if (effectiveTo) params.set("to", effectiveTo);
    fetch(`/api/payments?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((p) => setPayments(Array.isArray(p) ? p : []))
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setPaymentsLoading(false));
  }, [tab, period, dateFrom, dateTo]);

  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = payments.filter((p) => p.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Operational, financial, and export reports in one place</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "financial") setPaymentsLoading(true); }}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <>
          {analyticsLoading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              Loading analytics...
            </div>
          ) : analyticsError ? (
            <Card className="border-red-200"><CardContent className="flex h-48 flex-col items-center justify-center gap-2 text-red-600"><AlertCircle className="h-8 w-8" /><p className="font-medium">Analytics could not be loaded</p><p className="text-sm">{analyticsError}</p></CardContent></Card>
          ) : !data ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">No analytics data available.</div>
          ) : (
            <OverviewTab data={data} period={period} />
          )}
        </>
      )}

      {tab === "financial" && (
        <FinancialTab
          payments={payments}
          loading={paymentsLoading}
          overview={data?.overview || null}
          totalRevenue={totalRevenue}
          pendingCount={pendingPayments.length}
          pendingPayments={pendingPayments}
          period={period}
        />
      )}

      {tab === "reports" && <ReportsTab period={period} dateFrom={dateFrom} dateTo={dateTo} />}
    </div>
  );
}

function OverviewTab({ data }: { data: Analytics; period: string }) {
  const { bookingsByDay, hourlyDistribution, employeePerformance, customerTrends, revenueByStatus, storageLocations, overview } = data;
  const maxDailyCount = Math.max(...bookingsByDay.map((d) => d.count), 1);
  const maxDailyRevenue = Math.max(...bookingsByDay.map((d) => d.revenue), 1);
  const maxHourlyCount = Math.max(...hourlyDistribution.map((h) => h.count), 1);
  const maxEmployee = Math.max(...employeePerformance.map((e) => e.totalAssigned), 1);
  const maxStatusRevenue = Math.max(...revenueByStatus.map((x) => x.revenue), 1);
  const heatmapDays = bookingsByDay.slice(-60);
  const heatmapLeadingDays = heatmapDays.length > 0 ? new Date(`${heatmapDays[0].date}T00:00:00`).getDay() : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Bookings", value: overview.totalBookings.toLocaleString(), detail: `${overview.activeBookings} currently active`, color: "border-t-blue-500" },
          { label: "Collected Revenue", value: formatCurrency(overview.totalRevenue), detail: `${formatCurrency(overview.averagePrice)} average payment`, color: "border-t-emerald-500" },
          { label: "Average Bags", value: overview.averageBags.toFixed(1), detail: "per booking in selected period", color: "border-t-violet-500" },
          { label: "Storage Utilization", value: `${overview.storageUtilization.toFixed(1)}%`, detail: `${overview.newCustomers} new customers`, color: "border-t-orange-500" },
        ].map((metric) => (
          <Card key={metric.label} className={`border-t-2 ${metric.color}`}>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{metric.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p></CardContent>
          </Card>
        ))}
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

        {/* Revenue Over Time */}
        <Card className="border-t-2 border-t-green-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] rounded-lg bg-muted/20 p-2" style={{ height: 160 }}>
              {bookingsByDay.slice(-30).map((day, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all hover:from-emerald-700 hover:to-emerald-500"
                  style={{
                    height: `${(day.revenue / maxDailyRevenue) * 100}%`,
                    minHeight: day.revenue > 0 ? 4 : 0,
                  }}
                  title={`${day.date}: ${formatCurrency(day.revenue)}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Daily revenue for last {bookingsByDay.length} days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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

        {/* Revenue by Status */}
        <Card className="border-t-2 border-t-indigo-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 rounded-lg bg-muted/20 p-2" style={{ height: 160 }}>
              {revenueByStatus.map((s) => (
                <div
                  key={s.status}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-[10px] font-semibold text-muted-foreground">{formatCurrency(s.revenue)}</span>
                  <div
                    className="w-full max-w-[40px] rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all hover:from-indigo-700 hover:to-indigo-500"
                    style={{ height: `${Math.max((s.revenue / maxStatusRevenue) * 100, 4)}%` }}
                    title={`${s.status}: ${formatCurrency(s.revenue)}`}
                  />
                  <span className="max-w-[70px] truncate text-[9px] text-muted-foreground">{s.status.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Chart Types: Line, Pie, Donut */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Line Graph - Bookings & Revenue Over Time */}
        <Card className="md:col-span-2 border-t-2 border-t-sky-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Bookings & Revenue Trend (Line Graph)</CardTitle>
            <CardDescription>Daily bookings and collected revenue over the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <RechartsLine
              data={bookingsByDay.slice(-30).map((d) => ({ date: d.date, bookings: d.count, revenue: d.revenue }))}
              dataKeys={["bookings", "revenue"]}
              labels={["Bookings", "Revenue"]}
              colors={["#3b82f6", "#10b981"]}
            />
          </CardContent>
        </Card>

        {/* Pie Chart - Booking Status Breakdown */}
        <Card className="border-t-2 border-t-rose-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Booking Status Proportions (Pie Chart)</CardTitle>
            <CardDescription>Share of each booking status relative to the total.</CardDescription>
          </CardHeader>
          <CardContent>
            <RechartsPie
              data={data.bookingsByStatus.map((s) => ({ name: s.status.replace(/_/g, " "), value: s.count }))}
            />
          </CardContent>
        </Card>

        {/* Donut Chart - Revenue by Status */}
        <Card className="border-t-2 border-t-amber-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue Share by Status (Donut Chart)</CardTitle>
            <CardDescription>Distribution of collected revenue across booking statuses.</CardDescription>
          </CardHeader>
          <CardContent>
            <RechartsPie
              data={revenueByStatus.map((s) => ({ name: s.status.replace(/_/g, " "), value: s.revenue }))}
              isDonut
              currency
            />
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

      <Card className="border-t-2 border-t-orange-500">
        <CardHeader><CardTitle className="text-sm font-medium">Booking Activity Heatmap</CardTitle><CardDescription>Latest 60 days. Darker cells indicate higher booking activity.</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1" role="img" aria-label="Booking activity for the latest 60 days">
            {Array.from({ length: heatmapLeadingDays }, (_, index) => <span key={`empty-${index}`} className="aspect-square min-h-6" aria-hidden="true" />)}
            {heatmapDays.map((day) => {
              const intensity = day.count === 0 ? 0.06 : 0.25 + (day.count / maxDailyCount) * 0.75;
              return <div key={day.date} className="flex aspect-square min-h-6 items-center justify-center rounded border border-orange-600/10 text-[9px] font-medium text-orange-950/70" style={{ backgroundColor: `rgba(249, 115, 22, ${intensity})` }} title={`${new Date(`${day.date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}: ${day.count} bookings`} aria-label={`${day.date}: ${day.count} bookings`}>{new Date(`${day.date}T00:00:00`).getDate()}</div>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><span>Less</span>{[0.08, 0.3, 0.5, 0.7, 1].map((opacity) => <span key={opacity} className="h-3 w-3 rounded-sm border border-orange-600/10" style={{ backgroundColor: `rgba(249, 115, 22, ${opacity})` }} />)}<span>More</span></div>
        </CardContent>
      </Card>

      <Card className="border-t-2 border-t-cyan-500">
        <CardHeader><CardTitle className="text-sm font-medium">Storage Capacity by Location</CardTitle><CardDescription>Active bookings compared with configured capacity.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {storageLocations.map((location) => (
            <div key={location.name}>
              <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{location.name}</span><span className="text-muted-foreground">{location.used} / {location.capacity} · {location.utilization.toFixed(1)}%</span></div>
              <div className="h-2.5 rounded-full bg-muted"><div className={`h-full rounded-full ${location.utilization >= 90 ? "bg-red-500" : location.utilization >= 70 ? "bg-amber-500" : "bg-cyan-500"}`} style={{ width: `${Math.min(location.utilization, 100)}%` }} /></div>
            </div>
          ))}
          {storageLocations.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No storage locations configured.</p>}
        </CardContent>
      </Card>

      {/* Booking Status Breakdown */}
      <Card className="border-t-2 border-t-indigo-500">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Booking Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-52 items-end gap-3 rounded-lg bg-muted/20 p-4">
            {data.bookingsByStatus.map((s) => (
              <div key={s.status} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className={`w-full max-w-14 rounded-t ${statusDot[s.status] || "bg-gray-400"}`} style={{ height: `${Math.max((s.count / Math.max(...data.bookingsByStatus.map((x) => x.count), 1)) * 100, 3)}%` }} title={`${s.status.replace(/_/g, " ")}: ${s.count}`} />
                <span className="max-w-20 text-center text-[9px] text-muted-foreground">{s.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialTab({
  payments,
  loading,
  overview,
  totalRevenue,
  pendingCount,
  pendingPayments,
}: {
  payments: Payment[];
  loading: boolean;
  overview: Overview | null;
  totalRevenue: number;
  pendingCount: number;
  pendingPayments: Payment[];
  period: string;
}) {
  const paidPayments = payments.filter((p) => p.status === "PAID");
  const refundedPayments = payments.filter((p) => p.status === "REFUNDED");
  const methodTotals = Array.from(
    paidPayments.reduce((map, p) => {
      const key = p.method || "OTHER";
      map.set(key, (map.get(key) || 0) + p.amount);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);
  const maxMethodTotal = Math.max(...methodTotals.map(([, amt]) => amt), 1);
  const collectibleAmount = totalRevenue + pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-2 border-t-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{paidPayments.length} paid transactions</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
            <p className="text-xs text-muted-foreground">{pendingCount} pending</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-violet-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
              <Package className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalBookings || 0}</div>
            <p className="text-xs text-muted-foreground">{overview?.activeBookings || 0} active</p>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. per Booking</CardTitle>
            <div className="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview?.averagePrice || 0)}</div>
            <p className="text-xs text-muted-foreground">Storage utilization: {overview?.storageUtilization?.toFixed(1) || 0}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Payment Methods */}
        <Card className="border-t-2 border-t-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {methodTotals.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <DollarSign className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm">No payments recorded</p>
              </div>
            ) : (
              methodTotals.map(([method, amt]) => (
                <div key={method}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">{method}</span>
                    <span className="font-semibold text-muted-foreground">
                      {formatCurrency(amt)} &middot; {totalRevenue > 0 ? ((amt / totalRevenue) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${(amt / maxMethodTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Collection Status */}
        <Card className="border-t-2 border-t-emerald-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Collection Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-muted-foreground">Collected (PAID)</span>
              <span className="font-bold text-emerald-600">{formatCurrency(totalRevenue)}</span>
            </div>
            <div className="flex justify-between rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-muted-foreground">Outstanding (PENDING)</span>
              <span className="font-bold text-amber-600">
                {formatCurrency(pendingPayments.reduce((sum, p) => sum + p.amount, 0))}
              </span>
            </div>
            <div className="flex justify-between rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-muted-foreground">Refunded</span>
              <span className="font-bold text-red-600">{formatCurrency(refundedPayments.reduce((sum, payment) => sum + payment.amount, 0))}</span>
            </div>
            <div className="flex justify-between rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-muted-foreground">Collection rate</span>
              <span className="font-bold">
                {collectibleAmount === 0
                  ? "0%"
                  : `${((totalRevenue / collectibleAmount) * 100).toFixed(1)}%`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4" />
            Recent Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-3 text-gray-300" />
              <p>No payments yet</p>
            </div>
          ) : (
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Method</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.booking.referenceNumber}</td>
                      <td className="px-4 py-3">{p.customer.name.split(" ").map((part) => `${part.charAt(0)}${"•".repeat(Math.max(part.length - 1, 1))}`).join(" ")}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">{p.method}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === "PAID" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsTab({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  return (
    <div className="space-y-8">
      <AiReportsSection period={period} dateFrom={dateFrom} dateTo={dateTo} />
      <CsvReportsSection period={period} dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}

function AiReportsSection({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  const [reportType, setReportType] = useState<"descriptive" | "predictive" | "financial">("descriptive");
  const [report, setReport] = useState<{ title: string; summary: string; sections: { heading: string; content: string }[]; generatedAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  async function generateReport() {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const params = new URLSearchParams({ type: reportType, period });
      if (period === "custom" && dateFrom) params.set("from", dateFrom);
      if (period === "custom" && dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/analytics/reports?${params}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to generate report");
        return;
      }
      const json = await res.json();
      setReport(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!report) return;
    setPdfLoading(true);
    try {
      const res = await fetch("/api/analytics/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `dropnfly-${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("PDF report downloaded");
    } catch {
      toast.error("Failed to download PDF report");
    } finally {
      setPdfLoading(false);
    }
  }

  const reportTypes = [
    { id: "descriptive" as const, label: "Descriptive", desc: "Past performance analysis", icon: FileText, color: "border-t-blue-500", iconBg: "bg-blue-100 text-blue-600" },
    { id: "predictive" as const, label: "Predictive", desc: "Future trend forecasts", icon: TrendingUp, color: "border-t-violet-500", iconBg: "bg-violet-100 text-violet-600" },
    { id: "financial" as const, label: "Financial", desc: "Revenue & profitability", icon: DollarSign, color: "border-t-emerald-500", iconBg: "bg-emerald-100 text-emerald-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Reports</h2>
        <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
          <Brain className="h-3.5 w-3.5" />
          Gemini AI
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          const isActive = reportType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => { setReportType(rt.id); setReport(null); setError(""); }}
              className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                isActive ? `${rt.color} shadow-md bg-muted/20` : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${rt.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{rt.label}</p>
                  <p className="text-xs text-muted-foreground">{rt.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Button onClick={generateReport} disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
        ) : (
          <><Brain className="mr-2 h-4 w-4" /> Generate {reportTypes.find((r) => r.id === reportType)?.label} Report</>
        )}
      </Button>

      {error && (
        <Card className="border-t-2 border-t-yellow-500">
          <CardContent className="flex items-start gap-4 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Report unavailable</p>
              <p className="text-sm text-yellow-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card className="border-t-2 border-t-primary shadow-md">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                {report.title}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Generated {new Date(report.generatedAt).toLocaleString()}</span>
                <Button size="sm" variant="outline" onClick={downloadPdf} disabled={pdfLoading}>
                  <Download className="mr-2 h-4 w-4" />{pdfLoading ? "Preparing..." : "Download PDF"}
                </Button>
              </div>
            </div>
            <CardDescription className="text-sm leading-relaxed">
              {report.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.sections.map((section, i) => (
              <div key={i} className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <h4 className="font-medium text-sm">{section.heading}</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CsvReportsSection({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [reportAnchor] = useState(() => Date.now());

  const reports = [
    { id: "bookings", label: "Bookings Report", description: "All bookings with customer and payment details", icon: Package, endpoint: "/api/reports/bookings", filename: "bookings" },
    { id: "revenue", label: "Revenue Report", description: "Paid payments with customer and method details", icon: DollarSign, endpoint: "/api/reports/revenue", filename: "revenue" },
    { id: "analytics", label: "Analytics Summary", description: "Key metrics including bookings, revenue, and ratings", icon: BarChart3, endpoint: "/api/reports/analytics", filename: "analytics" },
  ];

  async function downloadReport(report: typeof reports[0]) {
    setDownloading(report.id);
    const params = new URLSearchParams();
    const periodDays = period === "week" ? 7 : period === "year" ? 365 : 30;
    const effectiveFrom = from || (period === "custom" ? dateFrom : new Date(reportAnchor - periodDays * 86400000).toISOString().slice(0, 10));
    const effectiveTo = to || (period === "custom" ? dateTo : new Date(reportAnchor).toISOString().slice(0, 10));
    if (effectiveFrom) params.set("from", effectiveFrom);
    if (effectiveTo) params.set("to", effectiveTo);
    try {
      const res = await fetch(`${report.endpoint}?${params}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.filename}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${report.label} downloaded`);
    } catch {
      toast.error(`Failed to download ${report.label}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">CSV Export</h2>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{report.label}</CardTitle>
                </div>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => downloadReport(report)} disabled={downloading === report.id} className="w-full">
                  {downloading === report.id ? "Downloading..." : <><Download className="mr-2 h-4 w-4" /> Download CSV</>}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
