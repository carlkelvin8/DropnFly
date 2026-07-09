"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, QrCode, Camera, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const STATUS_FLOW = [
  { value: "PENDING", label: "Upcoming" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "RECEIVED", label: "Received" },
  { value: "IN_STORAGE", label: "In-Storage Hub" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Completed" },
];

export default function QrScannerPage() {
  const [scanResult, setScanResult] = useState<{
    referenceNumber: string;
    currentStatus: string;
    customerName: string;
  } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualRef, setManualRef] = useState("");
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleScan = useCallback(async (ref: string) => {
    setScanning(true);
    try {
      const res = await fetch(`/api/bookings?include=basic&ref=${ref}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const booking = Array.isArray(data) ? data.find((b: any) => b.referenceNumber === ref) : null;
      if (!booking) return toast.error("Booking not found");
      setScanResult({
        referenceNumber: ref,
        currentStatus: booking.status,
        customerName: booking.customer?.name || "Unknown",
      });
      const currentIdx = STATUS_FLOW.findIndex((s) => s.value === booking.status);
      if (currentIdx < STATUS_FLOW.length - 1) {
        setSelectedStatus(STATUS_FLOW[currentIdx + 1].value);
      } else {
        setSelectedStatus(STATUS_FLOW[currentIdx].value);
      }
    } catch {
      toast.error("Booking not found or API error");
    }
    setScanning(false);
  }, []);

  async function handleSubmit() {
    if (!scanResult || !selectedStatus) return;
    setProcessing(true);
    try {
      const body: Record<string, unknown> = {
        referenceNumber: scanResult.referenceNumber,
        status: selectedStatus,
        note: note || undefined,
      };
      if (photo) body.photo = photo;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          body.latitude = pos.coords.latitude;
          body.longitude = pos.coords.longitude;
        } catch {}
      }

      const res = await fetch("/api/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Scan failed");
      }

      toast.success(`Updated to ${STATUS_FLOW.find((s) => s.value === selectedStatus)?.label}`);
      setScanResult(null);
      setPhoto(null);
      setNote("");
      setSelectedStatus("");
      setManualRef("");
    } catch (e: any) {
      toast.error(e.message || "Failed to process scan");
    }
    setProcessing(false);
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  if (!scanResult) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-2xl font-bold">QR Scanner</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Scan QR Code</CardTitle>
              <div className="flex gap-1 rounded-lg border p-0.5">
                <button onClick={() => setMode("camera")}
                  className={`px-3 py-1.5 text-xs rounded-md ${mode === "camera" ? "bg-primary text-primary-foreground" : ""}`}>
                  <Camera className="inline h-3.5 w-3.5 mr-1" /> Camera
                </button>
                <button onClick={() => { setMode("manual"); stopCamera(); }}
                  className={`px-3 py-1.5 text-xs rounded-md ${mode === "manual" ? "bg-primary text-primary-foreground" : ""}`}>
                  Manual
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "manual" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the booking reference number manually:</p>
                <div className="flex gap-2">
                  <input
                    value={manualRef}
                    onChange={(e) => setManualRef(e.target.value.toUpperCase())}
                    placeholder="e.g. BK-XXXX-XXXX"
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm"
                  />
                  <Button onClick={() => manualRef && handleScan(manualRef)} disabled={scanning || !manualRef}>
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Search
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative mx-auto aspect-square max-w-xs overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20">
                  {photo ? (
                    <img src={photo} alt="Captured" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Camera className="h-12 w-12" />
                      <p className="text-sm">Point camera at QR code</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="mr-2 h-4 w-4" /> Capture Photo
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setMode("manual")}>
                    <QrCode className="mr-2 h-4 w-4" /> Enter Manually
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                <p className="text-center text-xs text-muted-foreground">
                  Upload a photo of the QR code or enter the reference manually
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.findIndex((s) => s.value === scanResult.currentStatus);
  const nextStatuses = STATUS_FLOW.filter((_, i) => i > currentIdx);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => { setScanResult(null); setPhoto(null); }}>
          <ArrowLeft className="mr-2 h-4 w-4" /> New Scan
        </Button>
        <h1 className="text-xl font-bold">Scan Result</h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Booking Reference</p>
            <p className="text-lg font-bold font-mono">{scanResult.referenceNumber}</p>
            <p className="text-sm text-muted-foreground mt-1">Customer: {scanResult.customerName}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Current Status</p>
            <Badge className="text-sm px-3 py-1">
              {STATUS_FLOW.find((s) => s.value === scanResult.currentStatus)?.label || scanResult.currentStatus}
            </Badge>
          </div>

          {nextStatuses.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Update To</p>
              <div className="grid grid-cols-2 gap-2">
                {nextStatuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedStatus(s.value)}
                    className={`rounded-lg border p-3 text-sm font-medium transition-all text-left ${
                      selectedStatus === s.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {selectedStatus === s.value && <CheckCircle className="h-4 w-4 text-primary" />}
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This booking is already completed.</p>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Photo Proof</p>
            {photo ? (
              <div className="relative rounded-lg overflow-hidden border max-w-xs">
                <img src={photo} alt="Proof" className="w-full h-32 object-cover" />
                <button onClick={() => setPhoto(null)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs">Remove</button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> Capture Photo Proof
              </Button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Note (optional)</p>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this scan..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            />
          </div>

          <Button
            className="w-full" size="lg"
            onClick={handleSubmit}
            disabled={processing || !selectedStatus || selectedStatus === scanResult.currentStatus}
          >
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
            {processing ? "Processing..." : `Update to ${STATUS_FLOW.find((s) => s.value === selectedStatus)?.label}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
