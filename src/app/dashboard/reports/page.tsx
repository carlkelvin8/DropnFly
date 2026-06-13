"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, BarChart3, DollarSign, Package } from "lucide-react";
import { toast } from "sonner";

interface ReportOption {
  id: string;
  label: string;
  description: string;
  icon: typeof Package;
  endpoint: string;
  filename: string;
}

const reports: ReportOption[] = [
  {
    id: "bookings",
    label: "Bookings Report",
    description: "All bookings with customer and payment details",
    icon: Package,
    endpoint: "/api/reports/bookings",
    filename: "bookings",
  },
  {
    id: "revenue",
    label: "Revenue Report",
    description: "Paid payments with customer and method details",
    icon: DollarSign,
    endpoint: "/api/reports/revenue",
    filename: "revenue",
  },
  {
    id: "analytics",
    label: "Analytics Summary",
    description: "Key metrics including bookings, revenue, and ratings",
    icon: BarChart3,
    endpoint: "/api/reports/analytics",
    filename: "analytics",
  },
];

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadReport(report: ReportOption) {
    setDownloading(report.id);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`${report.endpoint}?${params}`);
      if (!res.ok) throw new Error("Failed to generate report");
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Reports</h1>
        <p className="text-sm text-muted-foreground">Download CSV reports for bookings, revenue, and analytics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range (Optional)</CardTitle>
          <CardDescription>Filter reports by date range</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

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
                <Button
                  onClick={() => downloadReport(report)}
                  disabled={downloading === report.id}
                  className="w-full"
                >
                  {downloading === report.id ? (
                    <>Downloading...</>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
