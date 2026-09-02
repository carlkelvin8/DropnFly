"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, QrCode, Camera, CheckCircle, Loader2, Package,
  Truck, Warehouse, ShieldCheck, MapPin, Clock,
  Tag, Briefcase, Search,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { CameraQRScanner } from "@/components/scanner/CameraQRScanner";
import { imageFileToDataUrl } from "@/lib/client-image";

const STATUS_FLOW = [
  { value: "PENDING", label: "Pending", icon: Clock, color: "bg-amber-500" },
  { value: "CONFIRMED", label: "Confirmed", icon: ShieldCheck, color: "bg-blue-500" },
  { value: "RECEIVED", label: "Picked Up", icon: Package, color: "bg-purple-500" },
  { value: "IN_STORAGE", label: "In Storage", icon: Warehouse, color: "bg-indigo-500" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck, color: "bg-orange-500" },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle, color: "bg-emerald-500" },
];

type VerificationType = "pickup" | "dropoff" | "status";

interface LuggageItemSummary {
  id: string;
  tagNumber: string;
  status: string;
}

interface ScanResult {
  referenceNumber: string;
  currentStatus: string;
  customerName: string;
  numberOfBags?: number;
  totalPrice?: number;
  pickupLocation?: string;
  dropOffLocation?: string;
  checkIn?: string;
  checkOut?: string | null;
  location?: { name?: string; city?: string } | null;
  luggageItems?: LuggageItemSummary[];
}

interface IntakeResult {
  luggage: {
    id: string;
    tagNumber: string;
    status: string;
    description: string | null;
    location: string | null;
    checkInAt: string;
    checkOutAt: string | null;
    flag: string | null;
    bookingId: string;
  };
  booking: {
    id: string;
    referenceNumber: string;
    status: string;
    numberOfBags: number;
    pickupLocation: string;
    dropOffLocation: string;
    checkIn: string;
    checkOut: string | null;
    customer: { name: string; email: string; phone: string };
  };
  remaining: number;
  storageEligible: boolean;
}

interface IntakeQueueBooking {
  id: string;
  referenceNumber: string;
  status: string;
  checkIn: string;
  rider: { name: string } | null;
}

function cleanScanInput(ref: string): string {
  const withoutQuery = ref.split("?")[0].split("#")[0];
  const clean = withoutQuery.includes("/")
    ? withoutQuery.split("/").pop() || ""
    : withoutQuery;
  return clean.trim().toUpperCase();
}

export default function QrScannerPage() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [tagNumbers, setTagNumbers] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualRef, setManualRef] = useState("");
  const [mode, setMode] = useState<"camera" | "manual" | "idle">("idle");
  const [verificationType, setVerificationType] = useState<VerificationType>("status");
  const [customerVerified, setCustomerVerified] = useState(false);
  const [customerScanMode, setCustomerScanMode] = useState(false);
  const [customerManualRef, setCustomerManualRef] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [flow, setFlow] = useState<"booking" | "luggage">("booking");
  const [intakeCamera, setIntakeCamera] = useState(false);
  const [intakeTag, setIntakeTag] = useState("");
  const [intakeRef, setIntakeRef] = useState("");
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeResult, setIntakeResult] = useState<IntakeResult | null>(null);
  const [intakeProcessing, setIntakeProcessing] = useState(false);
  const [intakeQueue, setIntakeQueue] = useState<IntakeQueueBooking[]>([]);
  const [queueBooking, setQueueBooking] = useState<IntakeQueueBooking | null>(null);
  const [queuePhoto, setQueuePhoto] = useState<string | null>(null);
  const [queueSearch, setQueueSearch] = useState("");

  const loadIntakeQueue = useCallback(() => {
    fetch("/api/bookings?include=basic")
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => setIntakeQueue(Array.isArray(rows) ? rows.filter((b) => ["RECEIVED", "IN_STORAGE"].includes(b.status)) : []))
      .catch(() => setIntakeQueue([]));
  }, []);

  useEffect(() => { loadIntakeQueue(); }, [loadIntakeQueue]);

  async function updateQueuedBooking() {
    if (!queueBooking) return;
    if (queueBooking.status === "RECEIVED" && !queuePhoto) {
      toast.error("Take a luggage verification photo before storage intake");
      return;
    }
    setIntakeProcessing(true);
    const nextStatus = queueBooking.status === "RECEIVED" ? "IN_STORAGE" : "OUT_FOR_DELIVERY";
    try {
      const res = await fetch("/api/qr/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referenceNumber: queueBooking.referenceNumber, status: nextStatus, photo: queuePhoto, note: `Intake queue update to ${nextStatus}` }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success(`Booking updated to ${nextStatus.replace(/_/g, " ")}`);
      setQueueBooking(null); setQueuePhoto(null); loadIntakeQueue();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setIntakeProcessing(false); }
  }

  const handleScan = useCallback(async (ref: string) => {
    const cleanRef = cleanScanInput(ref);

    setScanning(true);
    try {
      const res = await fetch(`/api/bookings?include=basic&ref=${encodeURIComponent(cleanRef)}`);
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
      const existingCount = booking.luggageItems?.length || 0;
      const slots = Math.max(0, (booking.numberOfBags || 0) - existingCount);
      setScanResult({
        referenceNumber: cleanRef,
        currentStatus: booking.status,
        customerName: booking.customer?.name || "Unknown",
        numberOfBags: booking.numberOfBags,
        totalPrice: booking.totalPrice,
        pickupLocation: booking.pickupLocation,
        dropOffLocation: booking.dropOffLocation,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        location: booking.location,
        luggageItems: booking.luggageItems || [],
      });
      setTagNumbers(
        Array.from({ length: slots }, () => "")
      );
      setCustomerVerified(false);
      setCustomerScanMode(false);
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
      if (customerVerified) body.customerVerified = true;
      if (verificationType === "pickup" && tagNumbers.length > 0) {
        body.tagNumbers = tagNumbers;
      }

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
          ? `✅ Luggage collected — ${scanResult.referenceNumber}`
          : verificationType === "dropoff"
          ? `✅ Delivery confirmed — ${scanResult.referenceNumber}`
          : `Updated to ${statusLabel}`
      );
      setScanResult(null);
      setPhoto(null);
      setNote("");
      setSelectedStatus("");
      setManualRef("");
      setTagNumbers([]);
      setVerificationType("status");
      setCustomerVerified(false);
      setCustomerScanMode(false);
      setCustomerManualRef("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to process scan";
      toast.error(message);
    }
    setProcessing(false);
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPhoto(await imageFileToDataUrl(file)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not read photo"); }
  }

  function handleTagChange(index: number, value: string) {
    setTagNumbers((prev) => prev.map((v, i) => (i === index ? value.toUpperCase() : v)));
  }

  function handleCustomerScan(ref: string) {
    if (!scanResult) return;
    const cleanRef = cleanScanInput(ref);
    if (cleanRef === scanResult.referenceNumber) {
      setCustomerVerified(true);
      setCustomerScanMode(false);
      setCustomerManualRef("");
      toast.success("Customer ownership verified");
    } else {
      toast.error("QR does not match this booking");
    }
  }

  async function handleIntakeLookup() {
    if (!intakeTag.trim() || !intakeRef.trim()) {
      toast.error("Enter both the baggage tag number and booking reference");
      return;
    }
    setIntakeLoading(true);
    setIntakeResult(null);
    try {
      const params = new URLSearchParams({
        tagNumber: intakeTag.trim().toUpperCase(),
        referenceNumber: intakeRef.trim().toUpperCase(),
      });
      const res = await fetch(`/api/luggage/by-tag?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed");
      setIntakeResult(json);
      toast.success("Luggage found — verify and confirm intake");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setIntakeLoading(false);
    }
  }

  async function handleIntakeConfirm() {
    if (!intakeResult) return;
    setIntakeProcessing(true);
    try {
      const res = await fetch("/api/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          luggageScan: true,
          tagNumber: intakeResult.luggage.tagNumber,
          referenceNumber: intakeResult.booking.referenceNumber,
          photo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Intake failed");
      toast.success(`✅ Luggage ${intakeResult.luggage.tagNumber} stored`);
      setIntakeResult(null);
      setIntakeTag("");
      setIntakeRef("");
      setPhoto(null);
      loadIntakeQueue();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Intake failed");
    } finally {
      setIntakeProcessing(false);
    }
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
            <p className="text-xs text-muted-foreground">
              {flow === "booking" ? "Scan to collect or verify bookings" : "Storage intake for collected luggage"}
            </p>
          </div>
        </div>

        {/* Flow toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1">
          <button
            onClick={() => { setFlow("booking"); setIntakeResult(null); setIntakeCamera(false); }}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              flow === "booking" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" /> Booking Scan
          </button>
          <button
            onClick={() => { setFlow("luggage"); setMode("idle"); }}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              flow === "luggage" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Warehouse className="h-4 w-4" /> Luggage Intake
          </button>
        </div>

        {/* Booking flow: action buttons */}
        {flow === "booking" && mode === "idle" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("camera")}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-blue-500 shadow-lg">
                <Camera className="h-7 w-7 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-900">Scan QR</p>
                <p className="text-[11px] text-blue-600/70">Use camera to scan</p>
              </div>
            </button>
            <button
              onClick={() => setMode("manual")}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-blue-500 shadow-lg">
                <QrCode className="h-7 w-7 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-900">Enter Transaction Code</p>
                <p className="text-[11px] text-blue-600/70">Type reference number</p>
              </div>
            </button>
          </div>
        )}

        {/* Booking flow: camera */}
        {flow === "booking" && mode === "camera" && (
          <CameraQRScanner
            onScan={handleScan}
            onClose={() => setMode("idle")}
            title="Scan Booking QR"
            description="Point at the luggage tag or booking slip"
          />
        )}

        {/* Booking flow: manual entry */}
        {flow === "booking" && mode === "manual" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Enter Transaction Code</CardTitle>
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

        {/* Luggage intake flow */}
        {flow === "luggage" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={queueSearch} onChange={(e) => setQueueSearch(e.target.value.toUpperCase())} placeholder="Filter intake by booking reference or rider" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Waiting to be stored</CardTitle></CardHeader>
              <CardContent className="max-h-72 space-y-2 overflow-y-auto">
                {intakeQueue.filter((b) => b.status === "RECEIVED" && (!queueSearch || `${b.referenceNumber} ${b.rider?.name || ""}`.toUpperCase().includes(queueSearch))).map((b) => <div key={b.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3"><div><p className="font-mono text-sm font-semibold">{b.referenceNumber}</p><p className="text-xs text-muted-foreground">{new Date(b.checkIn).toLocaleDateString()} · {b.rider?.name || "Unassigned"} · Received</p></div><Button size="sm" onClick={() => { setQueueBooking(b); setQueuePhoto(null); }}>Update</Button></div>)}
                {intakeQueue.every((b) => b.status !== "RECEIVED") && <p className="py-4 text-center text-sm text-muted-foreground">No luggage waiting for storage</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Waiting to be delivered</CardTitle></CardHeader>
              <CardContent className="max-h-72 space-y-2 overflow-y-auto">
                {intakeQueue.filter((b) => b.status === "IN_STORAGE" && (!queueSearch || `${b.referenceNumber} ${b.rider?.name || ""}`.toUpperCase().includes(queueSearch))).map((b) => <div key={b.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3"><div><p className="font-mono text-sm font-semibold">{b.referenceNumber}</p><p className="text-xs text-muted-foreground">{new Date(b.checkIn).toLocaleDateString()} · {b.rider?.name || "Unassigned"} · In storage</p></div><Button size="sm" onClick={() => { setQueueBooking(b); setQueuePhoto(null); }}>Update</Button></div>)}
                {intakeQueue.every((b) => b.status !== "IN_STORAGE") && <p className="py-4 text-center text-sm text-muted-foreground">No luggage waiting for delivery</p>}
              </CardContent>
            </Card>
            {intakeCamera ? (
              <CameraQRScanner
                onScan={(ref) => { setIntakeTag(cleanScanInput(ref)); setIntakeCamera(false); }}
                onClose={() => setIntakeCamera(false)}
                title="Scan Baggage Tag"
                description="Point at the physical tag on the luggage"
              />
            ) : intakeResult ? (
              <Card className="border-t-4 border-indigo-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="h-4 w-4 text-indigo-500" /> Luggage Intake
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setIntakeResult(null)}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> New Scan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Baggage Tag Number</p>
                      <p className="font-mono font-bold text-indigo-700">{intakeResult.luggage.tagNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Status</p>
                      <Badge variant="outline" className="mt-0.5">
                        {intakeResult.luggage.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Booking</p>
                        <p className="font-mono font-semibold">{intakeResult.booking.referenceNumber}</p>
                      </div>
                      <Badge variant="secondary">{intakeResult.booking.numberOfBags} bag{intakeResult.booking.numberOfBags > 1 ? "s" : ""}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{intakeResult.booking.customer.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p className="flex items-start gap-1 text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {intakeResult.booking.pickupLocation}
                      </p>
                      <p className="flex items-start gap-1 text-muted-foreground">
                        <Warehouse className="mt-0.5 h-3 w-3 shrink-0" /> {intakeResult.booking.dropOffLocation}
                      </p>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Booking status: {intakeResult.booking.status.replace(/_/g, " ")}
                    </p>
                  </div>

                  {!intakeResult.storageEligible ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      ⚠️ This booking is not ready for storage. Complete luggage collection first.
                    </div>
                  ) : intakeResult.luggage.status === "IN_STORAGE" ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                      ✓ This luggage is already in storage.
                    </div>
                  ) : (
                    <div className="space-y-3">
                    <label className="block rounded-lg border border-dashed p-3 text-sm"><span className="mb-2 block font-medium">Luggage verification photo (required)</span><input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} />{photo && <span className="mt-2 block text-xs text-emerald-600">Photo ready</span>}</label>
                    <Button
                      className="w-full h-11 rounded-xl"
                      size="lg"
                      onClick={handleIntakeConfirm}
                      disabled={intakeProcessing || !photo}
                    >
                      {intakeProcessing ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                      ) : (
                        <><Warehouse className="mr-2 h-5 w-5" /> Confirm Storage Intake</>
                      )}
                    </Button>
                    </div>
                  )}
                  {intakeResult.remaining > 0 && (
                    <p className="text-center text-[10px] text-muted-foreground">
                      {intakeResult.remaining} more luggage item{intakeResult.remaining > 1 ? "s" : ""} pending for this booking
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" /> Storage Intake
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">Physical baggage tags use printed numbers. Enter the tag number below for manual verification.</p>
                  <div className="space-y-2">
                    <input
                      value={intakeTag}
                      onChange={(e) => setIntakeTag(e.target.value.toUpperCase())}
                      placeholder="Baggage tag number (e.g. TAG-DROPFLY-SEED-001-1)"
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm font-mono shadow-sm"
                    />
                    <input
                      value={intakeRef}
                      onChange={(e) => setIntakeRef(e.target.value.toUpperCase())}
                      placeholder="Booking / transaction code"
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm font-mono shadow-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") handleIntakeLookup(); }}
                    />
                    <Button
                      className="w-full rounded-xl"
                      onClick={handleIntakeLookup}
                      disabled={intakeLoading || !intakeTag.trim() || !intakeRef.trim()}
                    >
                      {intakeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      Look Up Luggage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {queueBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <Card className="w-full max-w-md"><CardHeader><CardTitle>Update {queueBooking.referenceNumber}</CardTitle></CardHeader><CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Move from {queueBooking.status.replace(/_/g, " ")} to {queueBooking.status === "RECEIVED" ? "IN STORAGE" : "OUT FOR DELIVERY"}.</p>
              {queueBooking.status === "RECEIVED" && <div><p className="mb-2 text-sm font-medium">Luggage verification photo (required)</p><input type="file" accept="image/*" capture="environment" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setQueuePhoto(await imageFileToDataUrl(file)); } catch { toast.error("Could not read photo"); } }} />{queuePhoto && <p className="mt-2 text-xs text-emerald-600">Photo ready for verification</p>}</div>}
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setQueueBooking(null); setQueuePhoto(null); }}>Cancel</Button><Button disabled={intakeProcessing || (queueBooking.status === "RECEIVED" && !queuePhoto)} onClick={updateQueuedBooking}>{intakeProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Update"}</Button></div>
            </CardContent></Card>
          </div>
        )}

        {/* Recent scans tip */}
        {flow === "booking" && mode === "idle" && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Tips</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>📦 <strong>Collect:</strong> Scan booking, photograph luggage, assign physical tag numbers</p>
              <p>🏬 <strong>Intake:</strong> At the storage desk, scan each tag to move luggage to In Storage</p>
              <p>🚚 <strong>Delivery:</strong> Scan to confirm successful handover</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === SCAN RESULT: Shopee/Lazada verification workflow ===
  const currentIdx = STATUS_FLOW.findIndex((s) => s.value === scanResult.currentStatus);
  const nextStatuses = STATUS_FLOW.filter((_, i) => i > currentIdx);
  const isCollection = verificationType === "pickup";
  const existingTags = scanResult.luggageItems || [];
  const tagSlots = tagNumbers.length;
  const allTagsFilled = tagSlots === 0 || tagNumbers.every((t) => t.trim());

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setScanResult(null); setPhoto(null); setNote(""); setTagNumbers([]); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">
            {isCollection ? "Luggage Collection" :
             verificationType === "dropoff" ? "Delivery Confirmation" : "Status Update"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isCollection ? "Collect luggage and assign physical tags" : "Verify and confirm the action"}
          </p>
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

          {/* Trip summary */}
          {scanResult.pickupLocation && (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Pickup / Collection</p>
                  <p className="font-medium">{scanResult.pickupLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-indigo-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Drop-off / Storage</p>
                  <p className="font-medium">{scanResult.dropOffLocation || "—"}</p>
                </div>
              </div>
              {scanResult.checkIn && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    Check-in {new Date(scanResult.checkIn).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {scanResult.checkOut ? ` → ${new Date(scanResult.checkOut).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                  </span>
                </div>
              )}
            </div>
          )}

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
          { type: "pickup" as const, label: "Collection", icon: Package, desc: "Receive from customer" },
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

      {/* Luggage Tags (collection) */}
      {isCollection && selectedStatus === "RECEIVED" && (
        <Card className={allTagsFilled ? "" : "border-t-2 border-t-red-500"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Assign Baggage Tag Numbers
              <Badge variant="destructive" className="text-[10px]">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter the tag numbers printed on the physical tags taken from the DropnFly location — they must be identical to the tags attached to each luggage piece.
            </p>

            {existingTags.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Already tagged</p>
                {existingTags.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                    <span className="font-mono text-sm">{item.tagNumber}</span>
                    <Badge variant="outline" className="text-[10px]">{item.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            )}

            {tagSlots > 0 ? (
              <div className="space-y-2">
                {tagNumbers.map((value, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">
                      {existingTags.length + i + 1}
                    </div>
                    <input
                      value={value}
                      onChange={(e) => handleTagChange(i, e.target.value)}
                      placeholder={`Physical tag ${i + 1}`}
                      className="flex h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm font-mono shadow-sm"
                    />
                    {value.trim() ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="text-[10px] font-medium text-red-500 w-14 text-right">required</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-700">✓ All bags already have tags assigned.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Ownership Verification (drop-off / handover) */}
      {verificationType === "dropoff" && selectedStatus === "DELIVERED" && (
        <Card className={customerVerified ? "border-emerald-200 bg-emerald-50" : "border-t-2 border-t-orange-500"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verify Customer Ownership
              {!customerVerified && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerVerified ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">Customer QR verified — ownership confirmed</p>
              </div>
            ) : customerScanMode ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Scan the QR shown on the customer&apos;s phone (booking confirmation) to verify ownership.
                </p>
                <CameraQRScanner
                  onScan={handleCustomerScan}
                  onClose={() => setCustomerScanMode(false)}
                  title="Scan Customer QR"
                  description="Point at the QR on the customer's phone"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={customerManualRef}
                    onChange={(e) => setCustomerManualRef(e.target.value.toUpperCase())}
                    placeholder="Or enter reference manually"
                    className="flex h-10 flex-1 rounded-xl border border-input bg-background px-4 text-sm font-mono shadow-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && customerManualRef) handleCustomerScan(customerManualRef); }}
                  />
                  <Button variant="outline" size="sm" onClick={() => customerManualRef && handleCustomerScan(customerManualRef)}>
                    Verify
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setCustomerScanMode(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => setCustomerScanMode(true)}>
                <QrCode className="mr-2 h-4 w-4" /> Scan Customer QR
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Photo Proof */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {isCollection ? "Luggage Photo" : "Photo Proof"}
            {verificationType !== "status" && (
              <Badge variant="destructive" className="text-[10px]">Required</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photo ? (
            <div className="relative rounded-xl overflow-hidden border">
              <Image unoptimized width={800} height={320} src={photo} alt="Proof" className="w-full h-40 object-cover" />
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
                {isCollection ? "Photo confirmation of the luggage being collected" :
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
        disabled={
          processing ||
          !selectedStatus ||
          (verificationType !== "status" && !photo) ||
          (isCollection && selectedStatus === "RECEIVED" && !allTagsFilled) ||
          (verificationType === "dropoff" && selectedStatus === "DELIVERED" && !customerVerified)
        }
      >
        {processing ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
        ) : isCollection ? (
          <><Package className="mr-2 h-5 w-5" /> {tagSlots > 0 ? "Confirm Collection & Tags" : "Confirm Collection"}</>
        ) : verificationType === "dropoff" ? (
          <><Truck className="mr-2 h-5 w-5" /> Confirm Delivery</>
        ) : (
          <><CheckCircle className="mr-2 h-5 w-5" /> Update Status</>
        )}
      </Button>

      {verificationType !== "status" && !photo && (
        <p className="text-center text-xs text-amber-600">
          ⚠️ Photo of the luggage is required for {verificationType} verification
        </p>
      )}
      {isCollection && selectedStatus === "RECEIVED" && !allTagsFilled && (
        <p className="text-center text-xs text-red-600">
          ⚠️ Enter a tag number for every luggage piece before updating
        </p>
      )}
      {verificationType === "dropoff" && selectedStatus === "DELIVERED" && !customerVerified && (
        <p className="text-center text-xs text-orange-600">
          ⚠️ Scan the customer QR to verify ownership before confirming delivery
        </p>
      )}
    </div>
  );
}
