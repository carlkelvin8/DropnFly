"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface PublicIncident {
  trackingNumber: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  resolution: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  bookingReference: string;
  timeline: { id: string; action: string; description: string; createdAt: string }[];
}

export default function IncidentTrackingPage() {
  const params = useParams<{ trackingNumber: string }>();
  const [incident, setIncident] = useState<PublicIncident | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/incidents/${encodeURIComponent(params.trackingNumber)}`, { signal: controller.signal, cache: "no-store", credentials: "include" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || "Unable to load incident report");
        setIncident(body);
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [params.trackingNumber]);

  return (
    <div className="min-h-screen bg-blue-50/50 pt-16">
      <PublicHeader showBackToHome />
      <main className="mx-auto max-w-3xl px-4 py-12">
        {loading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Loading incident report...</CardContent></Card>
        ) : error || !incident ? (
          <Card className="border-t-4 border-red-500"><CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="font-semibold">Incident report unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error || "Please verify the incident number and email again."}</p>
            <Button asChild variant="outline" className="mt-5"><Link href="/track"><ArrowLeft className="mr-2 h-4 w-4" />Back to Tracker</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-red-700">{incident.trackingNumber}</p>
                <h1 className="text-2xl font-bold">Incident Report Status</h1>
                <p className="text-sm text-muted-foreground">Booking {incident.bookingReference}</p>
              </div>
              <Badge variant="outline" className="text-sm">{incident.status.replace(/_/g, " ")}</Badge>
            </div>

            <Card className="border-t-4 border-red-500">
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />Report Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium capitalize">{incident.type.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p><p className="font-medium capitalize">{incident.priority.toLowerCase()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Submitted</p><p className="font-medium">{formatDate(incident.submittedAt)}</p></div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4"><p>{incident.description}</p></div>
              </CardContent>
            </Card>

            {incident.resolution && (
              <Card className="border-t-4 border-emerald-500">
                <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-600" />Customer Resolution</CardTitle></CardHeader>
                <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed">{incident.resolution}</p></CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Investigation Timeline</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {incident.timeline.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-3"><p className="text-sm font-medium capitalize">{entry.action.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p></div>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
