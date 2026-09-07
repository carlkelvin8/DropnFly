"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  User,
  MapPin,
  Luggage,
  Building2,
  Clock,
  Plane,
  AlertTriangle,
  Package,
  Check,
  CreditCard,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { LUGGAGE_TYPES, calcTotalBags, buildLuggageDetails } from "@/lib/luggage-types";
import { NAIA_TERMINALS, FALLBACK_COUNTRIES, FALLBACK_CITIES, today } from "@/components/booking/constants";
import { getAirlinesForTerminal } from "@/lib/terminal-airlines";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import Image from "next/image";

interface TimeSlot {
  start: string;
  end: string;
  booked: number;
  available: boolean;
  unavailableReason?: "past" | "full" | null;
}

const COUNTRY_CITY_FALLBACK: Record<string, string[]> = FALLBACK_CITIES;

function calcStorageDays(pickupDate: string, pickupSlot: string, deliveryDate: string, deliverySlot: string): number {
  if (!pickupDate || !pickupSlot || !deliveryDate || !deliverySlot) return 0;
  const start = new Date(`${pickupDate}T${pickupSlot}:00+08:00`);
  const end = new Date(`${deliveryDate}T${deliverySlot}:00+08:00`);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function NewBookingPage() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  // Customer - walk-in creates a new customer (same fields as online booking)
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custCountry, setCustCountry] = useState("");
  const [custCity, setCustCity] = useState("");
  const [countries, setCountries] = useState<string[]>(FALLBACK_COUNTRIES);
  const [cities, setCities] = useState<string[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Pickup / Delivery - date + time-slot (same as online)
  const [pickupTerminal, setPickupTerminal] = useState("");
  const [pickupAirline, setPickupAirline] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupSlot, setPickupSlot] = useState("");
  const [pickupSlots, setPickupSlots] = useState<TimeSlot[]>([]);
  const [pickupSlotsLoading, setPickupSlotsLoading] = useState(false);

  const [deliveryTerminal, setDeliveryTerminal] = useState("");
  const [deliveryAirline, setDeliveryAirline] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [deliverySlots, setDeliverySlots] = useState<TimeSlot[]>([]);
  const [deliverySlotsLoading, setDeliverySlotsLoading] = useState(false);

  // Location (storage) - kept for compatibility, auto-selected
  const [locationId, setLocationId] = useState("");

  // Luggage
  const [luggageQty, setLuggageQty] = useState<Record<string, number>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState("");

  const [pickupFee, setPickupFee] = useState(180);
  const [deliveryFee, setDeliveryFee] = useState(180);
  const [excessBagFee, setExcessBagFee] = useState(100);
  const [excessBagThreshold, setExcessBagThreshold] = useState(3);
  const [luggagePrices, setLuggagePrices] = useState<Record<string, number>>({});
  const [maxBags, setMaxBags] = useState(10);
  const [slotRefreshTick, setSlotRefreshTick] = useState(0);

  const totalBags = calcTotalBags(luggageQty);
  const storageDays = calcStorageDays(pickupDate, pickupSlot, deliveryDate, deliverySlot);
  const billableDays = Math.max(1, storageDays || 1);
  const subtotal = LUGGAGE_TYPES.reduce((sum, lt) => {
    const qty = luggageQty[lt.id] || 0;
    const price = luggagePrices[lt.id] ?? lt.price;
    return sum + qty * price * billableDays;
  }, 0);
  const extraFee = totalBags > excessBagThreshold ? (totalBags - excessBagThreshold) * excessBagFee : 0;
  const servicesCost = (selectedServices["pick-up-from-customer"] ? pickupFee : 0) + (selectedServices["deliver-to-customer"] ? deliveryFee : 0);
  const grandTotal = Math.max(0, subtotal + extraFee + servicesCost - promoDiscount);

  function updatePickupDate(date: string) {
    setPickupDate(date);
    setPickupSlot("");
  }
  function updateDeliveryDate(date: string) {
    setDeliveryDate(date);
    setDeliverySlot("");
  }

  const fetchSlots = useCallback(async (date: string, type: "pickup" | "delivery"): Promise<TimeSlot[]> => {
    if (!date) return [];
    try {
      const res = await fetch(`/api/public/time-slots?date=${date}&type=${type}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.slots || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const locs = Array.isArray(data) ? data : [];
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch(() => {});
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.pricing) {
          if (data.pricing.pickup_fee) setPickupFee(data.pricing.pickup_fee);
          if (data.pricing.delivery_fee) setDeliveryFee(data.pricing.delivery_fee);
          if (data.pricing.excess_bag_fee) setExcessBagFee(data.pricing.excess_bag_fee);
          if (data.pricing.excess_bag_threshold) setExcessBagThreshold(data.pricing.excess_bag_threshold);
        }
        if (data.luggage_prices) setLuggagePrices(data.luggage_prices);
        const adminMax = data.booking_limits?.max_bags_per_booking;
        if (typeof adminMax === "number" && Number.isFinite(adminMax)) setMaxBags(Math.max(0, Math.floor(adminMax)));
      })
      .catch(() => {});
    fetch("/api/public/geo")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.countries) && data.countries.length > 0) {
          setCountries(data.countries.map((c: { name: string }) => c.name).sort((a: string, b: string) => a.localeCompare(b)));
        }
      })
      .catch(() => {})
      .finally(() => setCountriesLoading(false));
  }, []);

  useEffect(() => {
    if (!custCountry) return;
    setCitiesLoading(true);
    fetch("/api/public/geo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: custCountry }),
    })
      .then((res) => res.json())
      .then((data) => {
        const apiCities = Array.isArray(data.cities) ? data.cities : [];
        const fallback = COUNTRY_CITY_FALLBACK[custCountry] || [];
        setCities(fallback.length >= apiCities.length ? fallback : apiCities);
      })
      .catch(() => setCities(COUNTRY_CITY_FALLBACK[custCountry] || []))
      .finally(() => setCitiesLoading(false));
  }, [custCountry]);

  // slot refresh
  useEffect(() => {
    const t = window.setInterval(() => setSlotRefreshTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pickupDate) return;
    setPickupSlotsLoading(true);
    fetchSlots(pickupDate, "pickup").then((slots) => {
      setPickupSlots(slots);
      setPickupSlot((sel) => (sel && !slots.some((s) => s.start === sel && s.available) ? "" : sel));
      setPickupSlotsLoading(false);
    });
  }, [pickupDate, fetchSlots, slotRefreshTick]);

  useEffect(() => {
    if (!deliveryDate) return;
    setDeliverySlotsLoading(true);
    fetchSlots(deliveryDate, "delivery").then((slots) => {
      setDeliverySlots(slots);
      setDeliverySlot((sel) => (sel && !slots.some((s) => s.start === sel && s.available) ? "" : sel));
      setDeliverySlotsLoading(false);
    });
  }, [deliveryDate, fetchSlots, slotRefreshTick]);

  function handleNextStep() {
    const errors: string[] = [];
    if (step === 1) {
      if (!custName.trim()) errors.push("Please enter customer Full Name");
      if (!custEmail.trim()) errors.push("Please enter customer Email Address");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail.trim())) errors.push("Please enter a valid Email Address");
      if (!custPhone.trim()) errors.push("Please enter customer Phone Number");
      else if (!/^\+?[0-9\s\-()]{7,20}$/.test(custPhone.trim())) errors.push("Please enter a valid Phone Number");
      if (!custCountry) errors.push("Please select Country of Origin");
      if (!custCity) errors.push("Please select City of Origin");
    } else if (step === 2) {
      if (!pickupTerminal) errors.push("Please select Pickup Terminal");
      if (!pickupAirline) errors.push("Please select Pickup Airline Carrier");
      if (!pickupDate) errors.push("Please select Pickup Date");
      if (!pickupSlot) errors.push("Please select Pickup Time Slot");
      if (!deliveryTerminal) errors.push("Please select Drop-off Terminal");
      if (!deliveryAirline) errors.push("Please select Drop-off Airline Carrier");
      if (!deliveryDate) errors.push("Please select Delivery Date");
      if (!deliverySlot) errors.push("Please select Delivery Time Slot");
      if (pickupDate && deliveryDate) {
        if (deliveryDate < pickupDate) errors.push("Delivery date must be on or after Pickup Date");
        else if (deliveryDate === pickupDate && pickupSlot && deliverySlot && deliverySlot <= pickupSlot)
          errors.push("Delivery time slot must be after Pickup Time Slot");
      }
    } else if (step === 3) {
      if (totalBags === 0) errors.push("Please select at least one bag (Luggage Types)");
      if (maxBags > 0 && totalBags > maxBags) errors.push(`Maximum of ${maxBags} bags per booking`);
    }
    if (errors.length > 0) {
      setError(errors.join(". "));
      toast.error(errors[0]);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, 4));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (step !== 4) {
      toast.error("Please complete all steps first");
      return;
    }
    if (totalBags === 0) {
      toast.error("Please select at least one bag");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail.trim());
      if (!emailValid) {
        toast.error("Please enter a valid email address");
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(custPhone.trim())) {
        toast.error("Please enter a valid phone number");
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: custName.trim(),
          email: custEmail.trim().toLowerCase(),
          phone: custPhone.trim(),
          countryOfOrigin: custCountry,
          cityOfOrigin: custCity,
        }),
      });
      if (!custRes.ok) {
        const err = await custRes.json();
        toast.error(err.error || "Failed to create customer");
        setError(err.error || "Failed to create customer");
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      const newCust = await custRes.json();
      const customerId = newCust.id;

      const luggageItems = JSON.parse(buildLuggageDetails(luggageQty, luggagePrices));
      const selectedSvcList = [
        { id: "pick-up-from-customer", name: "Pick-up from Customer" },
        { id: "deliver-to-customer", name: "Deliver to Customer" },
      ]
        .filter((s) => selectedServices[s.id])
        .map((s) => s.name);
      const luggageDetails = selectedSvcList.length > 0 ? JSON.stringify([...luggageItems, { services: selectedSvcList }]) : buildLuggageDetails(luggageQty, luggagePrices);

      const pickupLocation = pickupAirline ? `${pickupTerminal} - ${pickupAirline}` : pickupTerminal;
      const dropOffLocation = deliveryAirline ? `${deliveryTerminal} - ${deliveryAirline}` : deliveryTerminal;
      const checkIn = `${pickupDate}T${pickupSlot}:00+08:00`;
      const checkOut = `${deliveryDate}T${deliverySlot}:00+08:00`;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          locationId: locationId || undefined,
          pickupLocation,
          dropOffLocation,
          luggageDetails,
          checkIn,
          checkOut,
          numberOfBags: totalBags,
          promoCode: promoApplied || undefined,
          status: "CONFIRMED",
        }),
      });

      if (res.ok) {
        toast.success("Walk-in booking created successfully!");
        router.push("/dashboard/bookings");
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create booking");
        setError(err.error || "Failed to create booking");
      }
    } catch {
      toast.error("Failed to create booking");
      setError("Failed to create booking");
    }
    setLoading(false);
    submittingRef.current = false;
  }

  const progress = ((step - 1) / 3) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/bookings">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Walk-in Booking</h1>
          <p className="text-sm text-muted-foreground">Walk-in customer — same complete process as online booking</p>
        </div>
      </div>

      {/* Progress */}
      <div className="relative">
        <div className="h-2 w-full rounded-full bg-border">
          <div className="h-2 rounded-full bg-orange-500 transition-[width] duration-500 ease-in-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex justify-between">
          {[
            { num: 1, label: "Contact", Icon: User },
            { num: 2, label: "Pickup", Icon: MapPin },
            { num: 3, label: "Luggage", Icon: Luggage },
            { num: 4, label: "Confirm", Icon: Check },
          ].map((s) => {
            const isActive = step >= s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${isActive ? "bg-orange-500 text-white shadow-md" : "bg-border text-muted-foreground/60"} ${isCurrent ? "ring-4 ring-blue-200" : ""}`}>
                  {isActive && step > s.num ? <Check className="h-4 w-4" /> : <s.Icon className="h-4 w-4" />}
                </div>
                <span className={`mt-1.5 text-[11px] font-medium ${isCurrent ? "text-blue-700" : isActive ? "text-blue-500" : "text-muted-foreground/60"}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardContent className="pt-6">
            {/* Step 1: Contact - same required fields as online */}
            {step === 1 && (
              <div className="space-y-4" style={{ animation: "step-in 0.25s ease-out" }}>
                <style>{`@keyframes step-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                <div className="mb-1 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                </div>
                <p className="text-xs text-muted-foreground rounded-lg border bg-blue-50/50 px-3 py-2">Walk-in — a new customer record will be created. Same complete fields as online booking.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="custName">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input id="custName" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Juan Dela Cruz" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custEmail">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input id="custEmail" type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="juan@email.com" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="custPhone">
                      Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <Input id="custPhone" type="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+63 912 345 6789" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custCountry">
                      Country of Origin <span className="text-red-500">*</span>
                    </Label>
                    <SearchableCombobox
                      id="custCountry"
                      value={custCountry}
                      onChange={(v) => {
                        setCustCountry(v);
                        setCities([]);
                        setCustCity("");
                      }}
                      options={countries}
                      loading={countriesLoading}
                      placeholder={countriesLoading ? "Loading countries..." : "Type to search a country"}
                    />
                    <p className="text-[11px] text-muted-foreground">All countries accepted.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custCity">
                      City of Origin <span className="text-red-500">*</span>
                    </Label>
                    <SearchableCombobox
                      id="custCity"
                      value={custCity}
                      onChange={setCustCity}
                      options={cities}
                      loading={citiesLoading}
                      disabled={!custCountry}
                      placeholder={!custCountry ? "Select country first" : citiesLoading ? "Loading cities..." : "Type to search a city"}
                    />
                    <p className="text-[11px] text-muted-foreground">Suggestions optional; type complete city if not listed.</p>
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="button" onClick={handleNextStep} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600">
                    Next: Pickup <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Pickup - same as online: terminals + airlines + date + time slots */}
            {step === 2 && (
              <div className="space-y-4" style={{ animation: "step-in 0.25s ease-out" }}>
                <div className="mb-1 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Pickup & Delivery Details</h3>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-500" /> Pickup Terminal <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={pickupTerminal}
                    onChange={(e) => {
                      setPickupTerminal(e.target.value);
                      setPickupAirline("");
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    required
                  >
                    <option value="">Select NAIA Terminal...</option>
                    {NAIA_TERMINALS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {pickupTerminal && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Plane className="h-4 w-4 text-blue-500" /> Pickup Airline Carrier <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={pickupAirline}
                      onChange={(e) => setPickupAirline(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                      required
                    >
                      <option value="">Select airline...</option>
                      {getAirlinesForTerminal(pickupTerminal).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground">Showing airlines available for {pickupTerminal}</p>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pickupDate">
                      Pickup Date <span className="text-red-500">*</span>
                    </Label>
                    <Input id="pickupDate" type="date" min={today()} value={pickupDate} onChange={(e) => updatePickupDate(e.target.value)} required />
                  </div>
                </div>
                {pickupDate && (
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-blue-500" /> Pickup Time Slot <span className="text-red-500">*</span>
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
                            className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${pickupSlot === slot.start ? "border-blue-600 bg-orange-500 text-white shadow-md" : slot.available ? "border-border bg-card hover:border-blue-300 hover:bg-blue-50" : "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"}`}
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

                <div className="my-4 border-t" />

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-indigo-500" /> Drop-off Terminal <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={deliveryTerminal}
                    onChange={(e) => {
                      setDeliveryTerminal(e.target.value);
                      setDeliveryAirline("");
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    required
                  >
                    <option value="">Select NAIA Terminal...</option>
                    {NAIA_TERMINALS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {deliveryTerminal && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Plane className="h-4 w-4 text-indigo-500" /> Drop-off Airline Carrier <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={deliveryAirline}
                      onChange={(e) => setDeliveryAirline(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                      required
                    >
                      <option value="">Select airline...</option>
                      {getAirlinesForTerminal(deliveryTerminal).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    Delivery Date <span className="text-red-500">*</span>
                  </Label>
                  <Input type="date" min={pickupDate || today()} value={deliveryDate} onChange={(e) => updateDeliveryDate(e.target.value)} required />
                </div>
                {deliveryDate && (
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-500" /> Delivery Time Slot <span className="text-red-500">*</span>
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
                            className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${deliverySlot === slot.start ? "border-indigo-600 bg-indigo-600 text-white shadow-md" : slot.available ? "border-border bg-card hover:border-indigo-300 hover:bg-indigo-50" : "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"}`}
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
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>
                      Storage Duration: <strong>{storageDays} day{storageDays > 1 ? "s" : ""}</strong> (from pickup to delivery)
                    </span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button type="button" variant="outline" onClick={() => { setError(""); setStep(1); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="button" onClick={handleNextStep} className="bg-orange-500 text-white hover:bg-orange-600">
                    Next: Luggage <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Luggage - same as online with storage multiplier, baggage notes, maxBags */}
            {step === 3 && (
              <div className="space-y-6" style={{ animation: "step-in 0.25s ease-out" }}>
                <div className="mb-1 flex items-center gap-2">
                  <Luggage className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Luggage Details</h3>
                  {maxBags > 0 && <span className="ml-auto rounded-full border bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">Max {maxBags} bag{maxBags !== 1 ? "s" : ""} per booking</span>}
                </div>

                {storageDays > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>
                      Storage Duration: <strong>{storageDays} day{storageDays > 1 ? "s" : ""}</strong> (from pickup to delivery)
                    </span>
                  </div>
                )}

                <div>
                  <Label className="mb-3 flex items-center gap-1.5 text-base">
                    <Package className="h-4 w-4 text-blue-500" /> Luggage Types — Select your bags
                  </Label>
                  <a href="/images/booking/references/pricing.png" target="_blank" rel="noreferrer" className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm">
                    <Image src="/images/booking/references/pricing.png" alt="pricing" width={940} height={788} className="h-6 w-8 rounded object-cover" />
                    Pricing & limits
                  </a>
                  <p className="mb-4 text-xs text-muted-foreground">Choose type and quantity. Prices shown are per day and multiplied by storage duration.</p>

                  <div className="mb-5 flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div className="space-y-1">
                      <p className="font-semibold">Important Baggage Notes</p>
                      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-amber-900">
                        <li><strong>Note 1:</strong> If your baggage exceeds the weight limit, it is okay as long as dimension fits within required size.</li>
                        <li><strong>Note 2:</strong> If dimension exceeds required dimension, you are required to upgrade declaration (e.g., Small → Large).</li>
                        <li><strong>Note 3:</strong> If you availed Pick-up/Drop-off, maximum 3 baggages will be carried.</li>
                        <li><strong>Note 4:</strong> Excess baggage beyond limit: additional ₱100 per extra baggage.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {LUGGAGE_TYPES.map((lt) => {
                      const qty = luggageQty[lt.id] || 0;
                      const price = luggagePrices[lt.id] ?? lt.price;
                      return (
                        <div key={lt.id} className={`relative overflow-hidden rounded-xl border-2 p-3 transition-all ${qty > 0 ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <a href={lt.referenceImage} target="_blank" rel="noreferrer" className="group relative mb-2 flex h-28 items-center justify-center overflow-hidden rounded-lg border bg-white">
                            <Image src={lt.referenceImage} alt={`${lt.name} ref`} width={940} height={788} className="h-full w-full object-contain" />
                          </a>
                          <div className="text-center">
                            <p className="text-sm font-bold">{lt.name}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{lt.description}</p>
                            <p className="mt-1 text-[11px] leading-tight text-muted-foreground/60">{lt.dimensions}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Max weight: {lt.maxWeight}</p>
                            <p className="mt-1 text-sm font-extrabold">₱{price}/day</p>
                          </div>
                          <div className="mt-3 flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => setLuggageQty((p) => ({ ...p, [lt.id]: Math.max(0, (p[lt.id] || 0) - 1) }))} className="flex h-8 w-8 items-center justify-center rounded-full border hover:border-blue-400 hover:bg-blue-50">
                              <span className="text-sm">−</span>
                            </button>
                            <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                            <button
                              type="button"
                              disabled={maxBags > 0 && totalBags >= maxBags}
                              onClick={() => setLuggageQty((p) => ({ ...p, [lt.id]: (p[lt.id] || 0) + 1 }))}
                              className="flex h-8 w-8 items-center justify-center rounded-full border hover:border-blue-400 hover:bg-blue-50 disabled:opacity-40"
                            >
                              <span className="text-sm">+</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalBags > 0 && (
                    <div className="mt-5 space-y-2 rounded-lg border bg-muted/50 p-4 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Total luggage:</span><span className="font-bold">{totalBags} bag{totalBags > 1 ? "s" : ""}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Storage subtotal ({billableDays} day{billableDays > 1 ? "s" : ""}):</span><span className="font-bold">₱{subtotal.toFixed(2)}</span></div>
                      {totalBags > excessBagThreshold && (
                        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm">
                          <span className="flex items-center gap-1.5 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Excess fee: {totalBags - excessBagThreshold} × ₱{excessBagFee.toFixed(2)} (over {excessBagThreshold})</span>
                          <span className="font-bold text-amber-700">+₱{extraFee.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="mb-2 flex items-center gap-1.5 text-sm"><Package className="h-4 w-4 text-violet-500" /> Additional Services</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { id: "pick-up-from-customer", name: "Pick-up from Customer", desc: "Rider picks up luggage from your location", fee: pickupFee },
                      { id: "deliver-to-customer", name: "Deliver to Customer", desc: "Rider delivers luggage to your location", fee: deliveryFee },
                    ].map((svc) => (
                      <label key={svc.id} className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all ${selectedServices[svc.id] ? "border-violet-500 bg-violet-600 text-white shadow-md" : "border-border bg-card"}`}>
                        <div className="flex items-center gap-3">
                          <Checkbox checked={!!selectedServices[svc.id]} onCheckedChange={(c) => setSelectedServices((p) => ({ ...p, [svc.id]: !!c }))} />
                          <div>
                            <p className="text-sm font-semibold">{svc.name}</p>
                            <p className={`mt-0.5 text-[11px] ${selectedServices[svc.id] ? "text-violet-100" : "text-muted-foreground"}`}>{svc.desc}</p>
                          </div>
                        </div>
                        <span className={`ml-3 shrink-0 text-sm font-bold ${selectedServices[svc.id] ? "text-white" : "text-violet-700"}`}>+₱{svc.fee}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button type="button" variant="outline" onClick={() => { setError(""); setStep(2); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="button" onClick={handleNextStep} className="bg-orange-500 text-white hover:bg-orange-600">
                    Next: Confirm <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Confirm - full summary same as online PaymentStep */}
            {step === 4 && (
              <div className="space-y-6" style={{ animation: "step-in 0.25s ease-out" }}>
                <div className="mb-1 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Booking Summary</h3>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transaction Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-muted-foreground"><span>Customer</span><span className="font-medium text-foreground">{custName} — {custEmail}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Phone</span><span className="font-medium">{custPhone}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Origin</span><span className="font-medium">{custCountry} — {custCity}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Pickup</span><span className="font-medium text-right max-w-[200px]">{pickupTerminal} - {pickupAirline}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Pickup Schedule</span><span className="font-medium">{pickupDate} at {pickupSlot}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Drop-off</span><span className="font-medium text-right max-w-[200px]">{deliveryTerminal} - {deliveryAirline}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Delivery Schedule</span><span className="font-medium">{deliveryDate} at {deliverySlot}</span></div>
                    {storageDays > 0 && <div className="flex justify-between text-blue-700 font-medium"><span>Storage Duration</span><span>{storageDays} day{storageDays > 1 ? "s" : ""}</span></div>}
                  </div>

                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Luggage</p>
                    <div className="space-y-1.5">
                      {LUGGAGE_TYPES.filter((lt) => (luggageQty[lt.id] || 0) > 0).map((lt) => (
                        <div key={lt.id} className="flex justify-between text-muted-foreground">
                          <span>{lt.name} <span className="text-muted-foreground/60">x{luggageQty[lt.id]}</span></span>
                          <span>₱{((luggagePrices[lt.id] ?? lt.price) * (luggageQty[lt.id] || 0) * billableDays).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(selectedServices["pick-up-from-customer"] || selectedServices["deliver-to-customer"]) && (
                    <div className="border-t pt-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Services</p>
                      {selectedServices["pick-up-from-customer"] && <div className="flex justify-between text-muted-foreground"><span>Pick-up from Customer</span><span>+₱{pickupFee.toFixed(2)}</span></div>}
                      {selectedServices["deliver-to-customer"] && <div className="flex justify-between text-muted-foreground"><span>Deliver to Customer</span><span>+₱{deliveryFee.toFixed(2)}</span></div>}
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Storage subtotal ({billableDays} day{billableDays > 1 ? "s" : ""})</span><span className="font-medium">₱{subtotal.toFixed(2)}</span></div>
                    {extraFee > 0 && <div className="flex justify-between text-amber-600"><span>Excess fee ({totalBags - excessBagThreshold} × ₱{excessBagFee.toFixed(2)})</span><span>+₱{extraFee.toFixed(2)}</span></div>}
                    {servicesCost > 0 && <div className="flex justify-between text-violet-600"><span>Additional services</span><span>+₱{servicesCost.toFixed(2)}</span></div>}
                    {promoApplied && <div className="flex justify-between text-green-600"><span>Promo discount ({promoApplied})</span><span>-₱{promoDiscount.toFixed(2)}</span></div>}
                    <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Estimated Total</span><span className="text-lg">₱{grandTotal.toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm">
                  <p className="text-xs text-blue-700">Walk-in booking — payment can be recorded later from the booking page. No payment required now. Booking will be confirmed immediately.</p>
                </div>

                <div className="space-y-2">
                  <Label>Promo Code</Label>
                  <div className="flex gap-2">
                    <Input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Enter promo code" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        setPromoError("");
                        setPromoDiscount(0);
                        setPromoApplied("");
                        if (!promoCode) return;
                        try {
                          const res = await fetch("/api/promo-codes/validate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ code: promoCode, amount: subtotal + extraFee + servicesCost }),
                          });
                          const data = await res.json();
                          if (data.valid) {
                            setPromoDiscount(data.discount);
                            setPromoApplied(promoCode);
                            setPromoCode("");
                          } else setPromoError(data.error || "Invalid promo code");
                        } catch {
                          setPromoError("Failed to validate");
                        }
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                  {promoApplied && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2 text-sm text-green-700">
                      <span>Promo &quot;{promoApplied}&quot; applied! Discount: ₱{promoDiscount.toFixed(2)}</span>
                      <button type="button" onClick={() => { setPromoApplied(""); setPromoDiscount(0); }} className="ml-auto text-green-500 hover:text-green-700">
                        Remove
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-sm text-red-500">{promoError}</p>}
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => { setError(""); setStep(3); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" disabled={loading || totalBags === 0} className="bg-orange-500 text-white hover:bg-orange-600">
                    {loading ? "Creating..." : "Create Booking"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
