"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Clock, MapPin, Package, Plane } from "lucide-react";
import { motion } from "framer-motion";
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
  pickupDate: string;
  setPickupDate: (v: string) => void;
  setPickupSlotsLoading: (v: boolean) => void;
  pickupSlots: TimeSlot[];
  pickupSlotsLoading: boolean;
  pickupSlot: string;
  setPickupSlot: (v: string) => void;
  deliveryTerminal: string;
  setDeliveryTerminal: (v: string) => void;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  setDeliverySlotsLoading: (v: boolean) => void;
  deliverySlots: TimeSlot[];
  deliverySlotsLoading: boolean;
  deliverySlot: string;
  setDeliverySlot: (v: string) => void;
  storageDays: number;
  error: string;
  onNext: () => void;
  onPrev: () => void;
}

export function PickupStep({
  pickupTerminal, setPickupTerminal, setPickupAirline, pickupAirline,
  pickupDate, setPickupDate, setPickupSlotsLoading,
  pickupSlots, pickupSlotsLoading, pickupSlot, setPickupSlot,
  deliveryTerminal, setDeliveryTerminal,
  deliveryDate, setDeliveryDate, setDeliverySlotsLoading,
  deliverySlots, deliverySlotsLoading, deliverySlot, setDeliverySlot,
  storageDays, error, onNext, onPrev,
}: PickupStepProps) {
  return (
    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
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
            <p className="mt-2 text-sm text-red-500">No available slots on this date.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pickupSlots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setPickupSlot(slot.start)}
                  className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${
                    pickupSlot === slot.start
                      ? "border-blue-600 bg-orange-500 text-white shadow-md"
                      : slot.available
                        ? "border-border bg-card text-foreground/80 hover:border-blue-300 hover:bg-blue-50"
                        : "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"
                  }`}
                >
                  <span className="block">{slot.start}</span>
                  <span className="block text-[10px] opacity-70">{slot.available ? slot.end : slot.unavailableReason === "past" ? "Past" : "Full"}</span>
                </button>
              ))}
            </div>
          )}
          {pickupSlot && <p className="mt-2 text-xs text-green-600">Selected: {pickupSlot}</p>}
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
          onChange={(e) => setDeliveryTerminal(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          required
        >
          <option value="">Select NAIA Terminal...</option>
          {NAIA_TERMINALS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

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
            <p className="mt-2 text-sm text-red-500">No available slots on this date.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {deliverySlots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setDeliverySlot(slot.start)}
                  className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${
                    deliverySlot === slot.start
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                      : slot.available
                        ? "border-border bg-card text-foreground/80 hover:border-indigo-300 hover:bg-indigo-50"
                        : "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"
                  }`}
                >
                  <span className="block">{slot.start}</span>
                  <span className="block text-[10px] opacity-70">{slot.available ? slot.end : slot.unavailableReason === "past" ? "Past" : "Full"}</span>
                </button>
              ))}
            </div>
          )}
          {deliverySlot && <p className="mt-2 text-xs text-green-600">Selected: {deliverySlot}</p>}
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
    </motion.div>
  );
}
