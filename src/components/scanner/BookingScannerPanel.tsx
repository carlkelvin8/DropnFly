"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera, CheckCircle, Loader2, Package, Truck, Warehouse,
  ShieldCheck, Clock, QrCode, ArrowLeft, MapPin,
} from "lucide-react";
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

interface BookingScannerPanelProps {
  referenceNumber: string;
  onUpdate?: () => void;
}

export function BookingScannerPanel({ referenceNumber, onUpdate }: BookingScannerPanelProps) {
  const [currentStatus, setCurrentStatus] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [verificationType, setVerificationType] = useState<VerificationType>("status");
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings?include=basic&ref=${encodeURIComponent(referenceNumber)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const booking = Array.isArray(data)
        ? data.find((b: { referenceNumber: string }) => b.referenceNumber === referenceNumber)
        : null;
      if (!booking) throw new Error();
      setCurrentStatus(booking.status);
      const currentIdx = STATUS_FLOW.findIndex((s) => s.value === booking.status);
      if (currentIdx < STATUS_FLOW.length - 1) {
        setSelectedStatus(STATUS_FLOW[currentIdx + 1].value);
      } else {
        setSelectedStatus("");
      }
      if (booking.status === "CONFIRMED") setVerificationType("pickup");
      else if (booking.status === "OUT_FOR_DELIVERY") setVerificationType("dropoff");
      else setVerificationType("status");
    } catch {
      toast.error("Failed to load booking status");
    } finally {
      setLoading(false);
    }
  }, [referenceNumber]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const currentIdx = STATUS_FLOW.findIndex((s) => s.value === currentStatus);
  const nextStatuses = STATUS_FLOW.filter((_, i) => i > currentIdx);

  function handleScanResult(ref: string) {
    const clean = ref.split("?")[0].split("#")[0].split("/").pop() || ref;
    if (clean.trim().toUpperCase() === referenceNumber.toUpperCase()) {
      toast.success("QR matches this booking");
      setScanMode(false);
      load();
    } else {
      toast.error("QR does not match this booking");
    }
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpdate() {
    if (!selectedStatus) return;
    setProcessing(true);
    try {
      const body: Record<string, unknown> = {
        referenceNumber,
        status: selectedStatus,
        note: note || `${verificationType} tracking update`,
      };
      if (photo) body.photo = photo;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          body.latitude = pos.coords.latitude;
          body.longitude = pos.coords.longitude;
        } catch { /* optional */ }
      }

      const res = await fetch("/api/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }
      const statusLabel = STATUS_FLOW.find((s) => s.value === selectedStatus)?.label;
      toast.success(`Tracking updated to ${statusLabel}`);
      setPhoto(null);
      setNote("");
      load();
      onUpdate?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">QR Tracking Scanner</p>
            <p className="text-[10px] text-muted-foreground">
              Scan or update the tracking progress of {referenceNumber}
            </p>
          </div>
        </div>
        {!scanMode && (
          <Button variant="outline" size="sm" onClick={() => setScanMode(true)}>
            <Camera className="mr-1 h-3.5 w-3.5" /> Scan QR
          </Button>
        )}
      </div>

      {scanMode && (
        <div className="space-y-2">
          <CameraQRScanner
            onScan={handleScanResult}
            onClose={() => setScanMode(false)}
            title="Scan Booking QR"
            description="Confirm this is the correct booking"
          />
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setScanMode(false)}>
            <ArrowLeft className="mr-1 h-3 w-3" /> Cancel scan
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : currentIdx < 0 ? (
        <p className="text-sm text-muted-foreground">Unable to load booking status.</p>
      ) : (
        <>
          {/* Status progress */}
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((step, i) => {
              const isCompleted = i <= currentIdx;
              return (
                <div key={step.value} className="flex items-center flex-1">
                  <div className={`h-2 flex-1 rounded-full ${isCompleted ? step.color : "bg-muted"}`} />
                </div>
              );
            })}
          </div>

          {/* Verification type */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { type: "pickup" as const, label: "Collection", icon: Package },
              { type: "dropoff" as const, label: "Delivery", icon: Truck },
              { type: "status" as const, label: "Status", icon: MapPin },
            ]).map((v) => (
              <button
                key={v.type}
                onClick={() => setVerificationType(v.type)}
                className={`rounded-lg border p-2 text-center transition-all ${
                  verificationType === v.type
                    ? "border-primary bg-background ring-1 ring-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <v.icon className={`mx-auto h-4 w-4 ${verificationType === v.type ? "text-primary" : "text-muted-foreground"}`} />
                <p className="mt-0.5 text-[10px] font-semibold">{v.label}</p>
              </button>
            ))}
          </div>

          {/* Next status */}
          {nextStatuses.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">Select next status</p>
              {nextStatuses.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => setSelectedStatus(s.value)}
                    className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                      selectedStatus === s.value
                        ? "border-primary bg-background ring-1 ring-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md ${s.color} text-white`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 text-xs font-medium">{s.label}</span>
                    {selectedStatus === s.value && <CheckCircle className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
              ✓ This booking is already completed.
            </p>
          )}

          {/* Photo proof */}
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">
              Photo proof {verificationType !== "status" && <Badge variant="destructive" className="text-[8px]">Required</Badge>}
            </p>
            {photo ? (
              <div className="relative overflow-hidden rounded-lg border">
                <Image unoptimized width={800} height={256} src={photo} alt="Proof" className="h-32 w-full object-cover" />
                <button
                  onClick={() => setPhoto(null)}
                  className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {verificationType === "pickup" ? "Photo of collected luggage" :
                   verificationType === "dropoff" ? "Photo of handover" : "Photo proof"}
                </p>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)..."
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-sm"
          />

          <Button
            className="w-full"
            onClick={handleUpdate}
            disabled={processing || !selectedStatus || (verificationType !== "status" && !photo)}
          >
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Update Tracking
          </Button>
        </>
      )}
    </div>
  );
}
