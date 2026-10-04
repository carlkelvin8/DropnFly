"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Search, Camera, Luggage } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CameraQRScanner } from "@/components/scanner/CameraQRScanner";
import { normalizeScannedReference } from "@/lib/scan-reference";

export default function TrackPage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [scanNotice, setScanNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  async function verifyAndOpen(candidateReference: string) {
    const normalized = normalizeScannedReference(candidateReference);
    if (!normalized || !email.trim()) return;
    setLoading(true);
    setError("");
    setScanNotice("");
    const response = await fetch("/api/public/bookings/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reference: normalized, email }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(body?.error || "Unable to verify booking details");
      setLoading(false);
      return;
    }
    const result = await response.json().catch(() => null);
    const destination = result?.kind === "incident"
      ? result.trackingNumber || normalized
      : result?.reference || normalized;
    router.push(result?.kind === "incident" ? `/track/incident/${destination}` : `/track/${destination}`);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await verifyAndOpen(reference);
  }

  function handleScan(raw: string) {
    const cleanRef = normalizeScannedReference(raw);
    setScanning(false);
    setError("");
    if (!cleanRef) {
      setError("The QR code does not contain a valid booking reference");
      return;
    }

    setReference(cleanRef);
    if (email.trim()) {
      void verifyAndOpen(cleanRef);
      return;
    }

    setScanNotice("QR scanned successfully. Enter the booking email to securely open the live status timeline.");
    window.setTimeout(() => emailInputRef.current?.focus(), 0);
  }

  return (
    <div className="min-h-screen bg-blue-50/50 pt-16">
      <PublicHeader showBackToHome />

      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 shadow-lg shadow-blue-200">
            <Luggage className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-blue-700">
            Track My Luggage
          </h1>
          <p className="mt-2 text-muted-foreground">
            Enter a booking reference or incident number with your email
          </p>
        </div>

        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardHeader>
            <CardTitle>Search by Reference</CardTitle>
            <CardDescription>
              Use your booking reference or incident tracking number from email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reference">Booking Reference or Incident Number</Label>
                <div>
                  <Input
                    id="reference"
                    placeholder="e.g. DROPFLY-ABC123 or INC-AB12CD34"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="font-mono uppercase"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Booking Email</Label>
                <Input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setScanNotice(""); }}
                  required
                />
                <p className="text-xs text-muted-foreground">Required to securely open tracking, including QR scans.</p>
              </div>
              {scanNotice && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{scanNotice}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-orange-500 text-white shadow-md hover:bg-orange-600">
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Verifying..." : "Track"}
              </Button>
            </form>

            {scanning ? (
              <div className="mt-6 border-t pt-6">
                <CameraQRScanner
                  onScan={handleScan}
                  onClose={() => setScanning(false)}
                  title="Scan Booking QR"
                  description="Point at the QR code from your confirmation email"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="w-full rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-all hover:border-blue-400 hover:bg-blue-50"
              >
                <Camera className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                <p className="text-sm font-medium text-foreground">
                  Scan QR Code from your confirmation email
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Enter the booking email above, then scan to open tracking automatically
                </p>
              </button>
            )}
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
