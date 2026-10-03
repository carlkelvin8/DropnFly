"use client";

import { useState } from "react";
import { nearestAvailableSlots } from "@/lib/fleet-capacity";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Clock, LocateFixed, Loader2, MapPin, Package, Plane } from "lucide-react";
import { AIRLINES, NAIA_TERMINALS, today } from "./constants";

interface TimeSlot {
  start: string;
  end: string;
  booked: number;
  available: boolean;
  unavailableReason?: "past" | "full" | null;
}

interface PickupStepProps {
  pickupTerminal: string;
  setPickupTerminal: (v: string) => void;
  setPickupAirline: (v: string) => void;
  pickupAirline: string;
  pickupPin: { lat: number; lng: number; accuracy: number | null } | null;
  setPickupPin: (pin: { lat: number; lng: number; accuracy: number | null } | null) => void;
  pickupDate: string;
  setPickupDate: (v: string) => void;
  setPickupSlotsLoading: (v: boolean) => void;
  pickupSlots: TimeSlot[];
  pickupSlotsLoading: boolean;
  pickupMaxConcurrent: number;
  pickupSlot: string;
  setPickupSlot: (v: string) => void;
  deliveryTerminal: string;
  setDeliveryTerminal: (v: string) => void;
  deliveryAirline: string;
  setDeliveryAirline: (v: string) => void;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  setDeliverySlotsLoading: (v: boolean) => void;
  deliverySlots: TimeSlot[];
  deliverySlotsLoading: boolean;
  deliveryMaxConcurrent: number;
  deliverySlot: string;
  setDeliverySlot: (v: string) => void;
  storageDays: number;
  error: string;
  onNext: () => void;
  onPrev: () => void;
}

export function PickupStep({
  pickupTerminal, setPickupTerminal, setPickupAirline, pickupAirline,
  pickupPin, setPickupPin,
  pickupDate, setPickupDate, setPickupSlotsLoading,
  pickupSlots, pickupSlotsLoading, pickupMaxConcurrent, pickupSlot, setPickupSlot,
  deliveryTerminal, setDeliveryTerminal, deliveryAirline, setDeliveryAirline,
  deliveryDate, setDeliveryDate, setDeliverySlotsLoading,
  deliverySlots, deliverySlotsLoading, deliveryMaxConcurrent, deliverySlot, setDeliverySlot,
  storageDays, error, onNext, onPrev,
}: PickupStepProps) {
  const [fullRequest, setFullRequest] = useState<{ type: "pickup" | "delivery"; date: string; time: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  function capturePickupPin() {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (position.coords.accuracy > 100) {
          setLocationError(`GPS accuracy is only ±${Math.round(position.coords.accuracy)}m. Move near an open area and try again.`);
        } else {
          setPickupPin({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy });
        }
        setLocating(false);
      },
      (error) => {
        setLocationError(error.code === error.PERMISSION_DENIED ? "Allow Location access, then try again." : "Could not get an accurate location. Please try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }
  const alternatives = (type: "pickup" | "delivery", date: string, slots: TimeSlot[], select: (value: string) => void) => {
    if (!fullRequest || fullRequest.type !== type || fullRequest.date !== date) return null;
    const nearest = nearestAvailableSlots(slots, fullRequest.time);
    return (
      <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">{fullRequest.time} — TIME SLOT FULL. Choose a nearest available hourly slot:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {nearest.map((slot) => <Button key={slot.start} type="button" size="sm" variant="outline" onClick={() => { select(slot.start); setFullRequest(null); }}>{slot.start}</Button>)}
          {nearest.length === 0 && <span>No available time slots. Please choose another date.</span>}
        </div>
      </div>
    );
  };
  return (
    <div key="step2" style={{ animation: "step-in 0.25s ease-out" }}>
      <style>{`@keyframes step-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Pickup Details</h3>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-blue-500" />
          Pickup Terminal <span className="text-red-500">*</span>
        </Label>
        <select
          value={pickupTerminal}
          onChange={(e) => {
            setPickupTerminal(e.target.value);
            setPickupAirline("");
            setPickupPin(null);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          required
        >
          <option value="">Select NAIA Terminal...</option>
          {NAIA_TERMINALS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {pickupTerminal && (
        <div className="mt-4 space-y-2">
          <Label className="flex items-center gap-1.5">
            <Plane className="h-4 w-4 text-blue-500" />
            Airline Carrier <span className="text-red-500">*</span>
          </Label>
          <select
            value={pickupAirline}
            onChange={(e) => setPickupAirline(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            required
          >
            <option value="">Select your airline...</option>
            {AIRLINES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

      {pickupTerminal && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-950">Exact customer pickup pin</p>
              <p className="text-xs text-blue-800">Use your current GPS position so the rider sees your actual meeting point instead of only the terminal fallback.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={capturePickupPin} disabled={locating} className="shrink-0 bg-white">
              {locating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-1.5 h-4 w-4" />}
              {pickupPin ? "Update exact pin" : "Use my location"}
            </Button>
          </div>
          {pickupPin && <p className="mt-2 text-xs font-medium text-emerald-700">Exact pin saved for this booking · accuracy ±{Math.round(pickupPin.accuracy || 0)}m</p>}
          {locationError && <p className="mt-2 text-xs font-medium text-red-600">{locationError}</p>}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pickupDate">Pickup Date <span className="text-red-500">*</span></Label>
          <Input id="pickupDate" type="date" min={today()} value={pickupDate} onChange={(e) => { setPickupDate(e.target.value); setPickupSlotsLoading(true); }} required />
        </div>
      </div>

      {pickupDate && (
        <div className="mt-4">
          <Label className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-500" />
            Pickup Time Slot <span className="text-red-500">*</span>
          </Label>
          {pickupSlotsLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading available slots...</p>
          ) : pickupSlots.length === 0 ? (
            <p className="mt-2 text-sm text-red-500">No available slots on this date — all vehicles occupied or store closed. Try another date.</p>
          ) : (
            <>
              {pickupSlots.every((s) => !s.available && s.unavailableReason === "full") && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>All {pickupMaxConcurrent} fleet vehicle{pickupMaxConcurrent > 1 ? "s" : ""} are occupied at every slot on this date — please choose another pickup date or time.</span>
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pickupSlots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={slot.unavailableReason === "past"}
                    title={!slot.available ? (slot.unavailableReason === "full" ? `Fully booked — ${slot.booked} of ${pickupMaxConcurrent} vehicle(s) already occupied at ${slot.start}` : "Past") : `${slot.start}–${slot.end} available`}
                    onClick={() => { if (slot.available) { setPickupSlot(slot.start); setFullRequest(null); } else { setPickupSlot(""); setFullRequest({ type: "pickup", date: pickupDate, time: slot.start }); } }}
                    className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${
                      pickupSlot === slot.start
                        ? "border-blue-600 bg-orange-500 text-white shadow-md"
                        : slot.available
                          ? "border-border bg-card text-foreground/80 hover:border-blue-300 hover:bg-blue-50"
                          : slot.unavailableReason === "full"
                            ? "cursor-not-allowed border-red-200 bg-red-50 text-red-600"
                            : "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"
                    }`}
                  >
                    <span className="block">{slot.start}</span>
                    <span className="block text-[10px] opacity-70">{slot.available ? slot.end : slot.unavailableReason === "past" ? "Past" : `Full • ${slot.booked}/${pickupMaxConcurrent} veh`}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {pickupSlot && <p className="mt-2 text-xs text-green-600">Selected: {pickupSlot}</p>}
          {alternatives("pickup", pickupDate, pickupSlots, setPickupSlot)}
        </div>
      )}

      <div className="my-6 border-t border-border" />

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-indigo-500" />
          Drop-off Terminal <span className="text-red-500">*</span>
        </Label>
        <select
          value={deliveryTerminal}
          onChange={(e) => {
            setDeliveryTerminal(e.target.value);
            setDeliveryAirline("");
          }}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          required
        >
          <option value="">Select NAIA Terminal...</option>
          {NAIA_TERMINALS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {deliveryTerminal && (
        <div className="mt-4 space-y-2">
          <Label className="flex items-center gap-1.5">
            <Plane className="h-4 w-4 text-indigo-500" />
            Drop-off Airline Carrier <span className="text-red-500">*</span>
          </Label>
          <select
            value={deliveryAirline}
            onChange={(e) => setDeliveryAirline(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            required
          >
            <option value="">Select your airline...</option>
            {AIRLINES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4">
        <Label className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-indigo-500" />
          Delivery Date <span className="text-red-500">*</span>
        </Label>
        <Input type="date" min={pickupDate || today()} value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); setDeliverySlotsLoading(true); }} className="mt-2" required />
      </div>

      {deliveryDate && (
        <div className="mt-4">
          <Label className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-indigo-500" />
            Delivery Time Slot <span className="text-red-500">*</span>
          </Label>
          {deliverySlotsLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading available slots...</p>
          ) : deliverySlots.length === 0 ? (
            <p className="mt-2 text-sm text-red-500">No available slots on this date — all vehicles occupied or store closed. Try another date.</p>
          ) : (
            <>
              {deliverySlots.every((s) => !s.available && s.unavailableReason === "full") && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>All {deliveryMaxConcurrent} fleet vehicle{deliveryMaxConcurrent > 1 ? "s" : ""} are occupied at every slot on this date — please choose another delivery date or time.</span>
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {deliverySlots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={slot.unavailableReason === "past"}
                    title={!slot.available ? (slot.unavailableReason === "full" ? `Fully booked — ${slot.booked} of ${deliveryMaxConcurrent} vehicle(s) already occupied at ${slot.start}` : "Past") : `${slot.start}–${slot.end} available`}
                    onClick={() => { if (slot.available) { setDeliverySlot(slot.start); setFullRequest(null); } else { setDeliverySlot(""); setFullRequest({ type: "delivery", date: deliveryDate, time: slot.start }); } }}
                    className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${
                      deliverySlot === slot.start
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                        : slot.available
                          ? "border-border bg-card text-foreground/80 hover:border-indigo-300 hover:bg-indigo-50"
                          : slot.unavailableReason === "full"
                            ? "cursor-not-allowed border-red-200 bg-red-50 text-red-600"
                            : "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"
                    }`}
                  >
                    <span className="block">{slot.start}</span>
                    <span className="block text-[10px] opacity-70">{slot.available ? slot.end : slot.unavailableReason === "past" ? "Past" : `Full • ${slot.booked}/${deliveryMaxConcurrent} veh`}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {deliverySlot && <p className="mt-2 text-xs text-green-600">Selected: {deliverySlot}</p>}
          {alternatives("delivery", deliveryDate, deliverySlots, setDeliverySlot)}
        </div>
      )}

      {storageDays > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Package className="h-4 w-4 shrink-0" />
          <span>
            Storage Duration: <strong>{storageDays} day{storageDays > 1 ? "s" : ""}</strong> (from pickup to delivery)
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <Button type="button" onClick={onNext} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600 disabled:opacity-50">
          Next Step <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
