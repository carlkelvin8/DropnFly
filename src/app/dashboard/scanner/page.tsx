"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, QrCode, Camera, CheckCircle, Loader2, Package,
  Truck, Warehouse, ShieldCheck, MapPin, Clock, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CameraQRScanner } from "@/components/scanner/CameraQRScanner";

const STATUS_FLOW = [
  { value: "PENDING", label: "Pending", icon: Clock, color: "bg-amber-500" },
  { value: "CONFIRMED", label: "Confirmed", icon: ShieldCheck, color: "bg-blue-500" },
  { value: "RECEIVED", label: "Picked Up", icon: Package, color: "bg-purple-500" },
  { value: "IN_STORAGE", label: "In Storage", icon: Warehouse, color: "bg-indigo-500" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck, color: "bg-orange-500" },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle, color: "bg-emerald-500" },
];

type VerificationType = "pickup" | "dropoff" | "status";

export default function QrScannerPage() {
  const [scanResult, setScanResult] = useState<{
    referenceNumber: string;
    currentStatus: string;
    customerName: string;
    numberOfBags?: number;
    totalPrice?: number;
  } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualRef, setManualRef] = useState("");
  const [mode, setMode] = useState<"camera" | "manual" | "idle">("idle");
  const [verificationType, setVerificationType] = useState<VerificationType>("status");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = useCallback(async (ref: string) => {
    // Clean up reference - might be a URL or just the code
    let cleanRef = ref;
    if (ref.includes("/")) {
      // Extract reference from URL like /track/DROPFLY-XXX
      const parts = ref.split("/");
      cleanRef = parts[parts.length - 1];
    }
    cleanRef = cleanRef.trim().toUpperCase();

    setScanning(true);
    try {
      const res = await fetch(`/api/bookings?include=basic&ref=${cleanRef}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const booking = Array.isArray(data)
        ? data.find((b: { referenceNumber: string }) => b.referenceNumber === cleanRef)
        : null;
      if (!booking) {
        toast.error("Booking not found");
        setScanning(false);
        return;
      }
      setScanResult({
        referenceNumber: cleanRef,
        currentStatus: booking.status,
        customerName: booking.customer?.name || "Unknown",
        numberOfBags: booking.numberOfBags,
        totalPrice: booking.totalPrice,
      });
      // Auto-select next status
      const currentIdx = STATUS_FLOW.findIndex((s) => s.value === booking.status);
      if (currentIdx < STATUS_FLOW.length - 1) {
        setSelectedStatus(STATUS_FLOW[currentIdx + 1].value);
      }
      // Auto-detect verification type
      if (booking.status === "CONFIRMED") setVerificationType("pickup");
      else if (booking.status === "OUT_FOR_DELIVERY") setVerificationType("dropoff");
      else setVerificationType("status");

      setMode("idle");
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
        note: note || `${verificationType} verification`,
      };
      if (photo) body.photo = photo;

      // Attach geolocation
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          body.latitude = pos.coords.latitude;
          body.longitude = pos.coords.longitude;
        } catch { /* location optional */ }
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

      const statusLabel = STATUS_FLOW.find((s) => s.value === selectedStatus)?.label;
      toast.success(
        verificationType === "pickup"
          ? `✅ Pickup verified — ${scanResult.referenceNumber}`
          : verificationType === "dropoff"
          ? `✅ Delivery confirmed — ${scanResult.referenceNumber}`
          : `Updated to ${statusLabel}`
      );
      setScanResult(null);
      setPhoto(null);
      setNote("");
      setSelectedStatus("");
      setManualRef("");
      setVerificationType("status");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to process scan";
      toast.error(message);
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

  // === NO SCAN RESULT: Show scanner ===
  if (!scanResult) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">QR Scanner</h1>
            <p className="text-xs text-muted-foreground">Scan to verify pickup or delivery</p>
          </div>
        </div>

        {/* Action buttons - Shopee/Lazada style */}
        {mode === "idle" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("camera")}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                <Camera className="h-7 w-7 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-900">Scan QR</p>
                <p className="text-[11px] text-blue-600/70">Use camera to scan</p>
              </div>
            </button>
            <button
              onClick={() => setMode("manual")}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-6 transition-all hover:border-violet-400 hover:bg-violet-50 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                <QrCode className="h-7 w-7 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-violet-900">Enter Code</p>
                <p className="text-[11px] text-violet-600/70">Type reference number</p>
              </div>
            </button>
          </div>
        )}

        {/* Camera Scanner */}
        {mode === "camera" && (
          <CameraQRScanner
            onScan={handleScan}
            onClose={() => setMode("idle")}
            title="Scan Booking QR"
            description="Point at the luggage tag or booking slip"
          />
        )}

        {/* Manual Entry */}
        {mode === "manual" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Enter Reference</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setMode("idle")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value.toUpperCase())}
                  placeholder="e.g. DROPFLY-SEED-001"
                  className="flex h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onKeyDown={(e) => { if (e.key === "Enter" && manualRef) handleScan(manualRef); }}
                />
                <Button
                  onClick={() => manualRef && handleScan(manualRef)}
                  disabled={scanning || !manualRef}
                  className="rounded-xl"
                >
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent scans tip */}
        {mode === "idle" && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Tips</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>📦 <strong>Pickup:</strong> Scan when receiving luggage from customer</p>
              <p>🚚 <strong>Delivery:</strong> Scan to confirm successful handover</p>
              <p>📷 <strong>Photo proof:</strong> Take a photo for verification records</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === SCAN RESULT: Shopee/Lazada verification workflow ===
  const currentIdx = STATUS_FLOW.findIndex((s) => s.value === scanResult.currentStatus);
  const nextStatuses = STATUS_FLOW.filter((_, i) => i > currentIdx);
  const currentStatus = STATUS_FLOW[currentIdx];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setScanResult(null); setPhoto(null); setNote(""); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">
            {verificationType === "pickup" ? "Pickup Verification" :
             verificationType === "dropoff" ? "Delivery Confirmation" : "Status Update"}
          </h1>
          <p className="text-xs text-muted-foreground">Verify and confirm the action</p>
        </div>
      </div>

      {/* Booking Info Card */}
      <Card className="border-t-4 border-blue-500">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="text-lg font-bold font-mono">{scanResult.referenceNumber}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{scanResult.customerName}</p>
            </div>
            <div className="text-right">
              {scanResult.numberOfBags && (
                <Badge variant="secondary" className="mb-1">
                  {scanResult.numberOfBags} bag{scanResult.numberOfBags > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>

          {/* Status Progress */}
          <div className="mt-4 flex items-center gap-1">
            {STATUS_FLOW.map((step, i) => {
              const isCompleted = i <= currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={step.value} className="flex items-center flex-1">
                  <div className={`h-2 flex-1 rounded-full ${
                    isCompleted ? step.color : "bg-muted"
                  } ${isCurrent ? "animate-pulse" : ""}`} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Pending</span>
            <span>Delivered</span>
          </div>
        </CardContent>
      </Card>

      {/* Verification Type Selector */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { type: "pickup" as const, label: "Pickup", icon: Package, desc: "Receive from customer" },
          { type: "dropoff" as const, label: "Delivery", icon: Truck, desc: "Hand to customer" },
          { type: "status" as const, label: "Status", icon: MapPin, desc: "Update progress" },
        ]).map((v) => (
          <button
            key={v.type}
            onClick={() => setVerificationType(v.type)}
            className={`rounded-xl border p-3 text-center transition-all ${
              verificationType === v.type
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                : "hover:bg-muted/50"
            }`}
          >
            <v.icon className={`mx-auto h-5 w-5 ${verificationType === v.type ? "text-primary" : "text-muted-foreground"}`} />
            <p className="mt-1 text-xs font-semibold">{v.label}</p>
          </button>
        ))}
      </div>

      {/* Next Status */}
      {nextStatuses.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Update Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextStatuses.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  onClick={() => setSelectedStatus(s.value)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    selectedStatus === s.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.label}</p>
                  </div>
                  {selectedStatus === s.value && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">This booking is already completed</p>
          </CardContent>
        </Card>
      )}

      {/* Photo Proof */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Photo Proof
            {verificationType !== "status" && (
              <Badge variant="destructive" className="text-[10px]">Required</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photo ? (
            <div className="relative rounded-xl overflow-hidden border">
              <img src={photo} alt="Proof" className="w-full h-40 object-cover" />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-2 right-2 rounded-full bg-red-500 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-6 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Camera className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {verificationType === "pickup" ? "Photo of received luggage" :
                 verificationType === "dropoff" ? "Photo of handover to customer" :
                 "Capture photo proof"}
              </p>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Note */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)..."
        className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm shadow-sm"
      />

      {/* Submit Button */}
      <Button
        className="w-full h-12 rounded-xl text-base font-semibold shadow-lg"
        size="lg"
        onClick={handleSubmit}
        disabled={processing || !selectedStatus || (verificationType !== "status" && !photo)}
      >
        {processing ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
        ) : verificationType === "pickup" ? (
          <><Package className="mr-2 h-5 w-5" /> Confirm Pickup</>
        ) : verificationType === "dropoff" ? (
          <><Truck className="mr-2 h-5 w-5" /> Confirm Delivery</>
        ) : (
          <><CheckCircle className="mr-2 h-5 w-5" /> Update Status</>
        )}
      </Button>

      {verificationType !== "status" && !photo && (
        <p className="text-center text-xs text-amber-600">
          ⚠️ Photo proof required for {verificationType} verification
        </p>
      )}
    </div>
  );
}
