"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Brain,
  FileText,
  RefreshCw,
  AlertCircle,
  Download,
  CreditCard,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

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

interface Overview {
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  averagePrice: number;
  totalCustomers: number;
  storageUtilization: number;
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

type Tab = "overview" | "graphs" | "reports";

const statusDot: Record<string, string> = {
  PAID: "bg-green-500",
  PENDING: "bg-yellow-500",
  FAILED: "bg-red-500",
};

export default function FinancialOversightPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [analytics, setAnalytics] = useState<Overview | null>(null);
  const [bookingsByDay, setBookingsByDay] = useState<DayData[]>([]);
  const [hourly, setHourly] = useState<HourData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/payments").then((r) => r.ok ? r.json() : []),
      fetch(`/api/analytics?period=${period}`).then((r) => r.ok ? r.json() : { overview: null, bookingsByDay: [], hourlyDistribution: [] }),
    ]).then(([payData, analyticsData]: [unknown, Record<string, unknown>]) => {
      setPayments(Array.isArray(payData) ? payData : []);
      setAnalytics((analyticsData?.overview as Overview) || null);
      setBookingsByDay(Array.isArray(analyticsData?.bookingsByDay) ? analyticsData.bookingsByDay as DayData[] : []);
      setHourly(Array.isArray(analyticsData?.hourlyDistribution) ? analyticsData.hourlyDistribution as HourData[] : []);
    }).catch(() => toast.error("Failed to load financial data"))
      .finally(() => setLoading(false));
  }, [period]);

  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = payments.filter((p) => p.status === "PENDING");
  const maxDailyCount = Math.max(...bookingsByDay.map((d) => d.count), 1);
  const maxHourlyCount = Math.max(...hourly.map((h) => h.count), 1);

  const tabs: { id: Tab; label: string; icon: typeof DollarSign }[] = [
    { id: "overview", label: "Overview", icon: DollarSign },
    { id: "graphs", label: "Graphical", icon: BarChart3 },
    { id: "reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Financial Oversight</h1>
          <p className="text-sm text-muted-foreground">Payments, revenue data, and analytics</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {["week", "month", "year"].map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
              className={period === p ? "" : "text-muted-foreground"}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === "overview" && (
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
                    <p className="text-xs text-muted-foreground">{payments.filter((p) => p.status === "PAID").length} paid transactions</p>
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
                    <p className="text-xs text-muted-foreground">{pendingPayments.length} pending</p>
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
                    <div className="text-2xl font-bold">{analytics?.totalBookings || 0}</div>
                    <p className="text-xs text-muted-foreground">{analytics?.activeBookings || 0} active</p>
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
                    <div className="text-2xl font-bold">{formatCurrency(analytics?.averagePrice || 0)}</div>
                    <p className="text-xs text-muted-foreground">Storage utilization: {analytics?.storageUtilization?.toFixed(1) || 0}%</p>
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
                  {payments.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <DollarSign className="mx-auto h-12 w-12 mb-3 text-gray-300" />
                      <p>No payments yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
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
                              <td className="px-4 py-3">{p.customer.name}</td>
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
          )}

          {/* Graphs Tab */}
          {tab === "graphs" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-t-2 border-t-blue-500">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Bookings Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bookingsByDay.length > 0 ? (
                      <>
                        <div className="flex items-end gap-[3px] rounded-lg bg-muted/20 p-2" style={{ height: 180 }}>
                          {bookingsByDay.slice(-30).map((day, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                              style={{
                                height: `${(day.count / maxDailyCount) * 100}%`,
                                minHeight: day.count > 0 ? 4 : 0,
                              }}
                              title={`${day.date}: ${day.count} bookings (${formatCurrency(day.revenue)})`}
                            />
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground text-center">Last 30 days activity</p>
                      </>
                    ) : (
                      <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-t-2 border-t-emerald-500">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Peak Booking Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hourly.length > 0 ? (
                      <>
                        <div className="flex items-end gap-[3px] rounded-lg bg-muted/20 p-2" style={{ height: 180 }}>
                          {hourly.map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t bg-emerald-500 transition-all hover:bg-emerald-600"
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
                      </>
                    ) : (
                      <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-t-2 border-t-violet-500">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Revenue Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Collected Revenue</p>
                    </div>
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{pendingPayments.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Pending Payments</p>
                    </div>
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{analytics?.totalCustomers || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Customers</p>
                    </div>
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold text-violet-600">{analytics?.storageUtilization?.toFixed(1) || 0}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Storage Utilization</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reports Tab */}
          {tab === "reports" && (
            <div className="space-y-6">
              <AiReportsSection />
              <CsvReportsSection />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AiReportsSection() {
  const [reportType, setReportType] = useState<"descriptive" | "predictive" | "financial">("descriptive");
  const [report, setReport] = useState<{ title: string; summary: string; sections: { heading: string; content: string }[]; generatedAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateReport() {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch(`/api/analytics/reports?type=${reportType}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to generate report");
        return;
      }
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report generation failed");
    } finally {
      setLoading(false);
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
        <h2 className="text-lg font-semibold">AI Analytics Reports</h2>
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

      <Button onClick={generateReport} disabled={loading}>
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                {report.title}
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">
                Generated {new Date(report.generatedAt).toLocaleString()}
              </span>
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

function CsvReportsSection() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const reports = [
    { id: "bookings", label: "Bookings Report", description: "All bookings with customer and payment details", icon: Package, endpoint: "/api/reports/bookings", filename: "bookings" },
    { id: "revenue", label: "Revenue Report", description: "Paid payments with customer and method details", icon: DollarSign, endpoint: "/api/reports/revenue", filename: "revenue" },
    { id: "analytics", label: "Analytics Summary", description: "Key metrics including bookings, revenue, and ratings", icon: BarChart3, endpoint: "/api/reports/analytics", filename: "analytics" },
  ];

  async function downloadReport(report: typeof reports[0]) {
    setDownloading(report.id);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
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
