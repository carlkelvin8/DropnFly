"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";
import {
  User,
  Luggage,
  MapPin,
  CreditCard,
  ArrowLeft,
  Plus,
  Minus,
  AlertTriangle,
  Package,
  Plane,
  Building2,
  Clock,
} from "lucide-react";
import { LUGGAGE_TYPES, EXTRA_BAG_FEE, EXTRA_BAG_THRESHOLD, calcSubtotal, calcTotalBags, calcExtraFee, buildLuggageDetails } from "@/lib/luggage-types";
import { NAIA_TERMINALS, FALLBACK_COUNTRIES, FALLBACK_CITIES } from "@/components/booking/constants";
import { getAirlinesForTerminal } from "@/lib/terminal-airlines";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const ADDITIONAL_SERVICES = [
  { id: "pick-up-from-customer", name: "Pick-up from Customer", price: 180 },
  { id: "deliver-to-customer", name: "Deliver to Customer", price: 180 },
] as const;

const COUNTRY_FALLBACK = FALLBACK_COUNTRIES;

const COUNTRY_CITY_FALLBACK: Record<string, string[]> = FALLBACK_CITIES;

export default function NewBookingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Customer fields - walk-in always creates a new customer
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custCountry, setCustCountry] = useState("");
  const [custCity, setCustCity] = useState("");
  const [countries, setCountries] = useState<string[]>(COUNTRY_FALLBACK);
  const [cities, setCities] = useState<string[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Terminal/Airline
  const [terminal, setTerminal] = useState("");
  const [airline, setAirline] = useState("");
  const [dropOffTerminal, setDropOffTerminal] = useState("Villamor, Pasay City");

  // Location
  const [locationId, setLocationId] = useState("");

  // Schedule
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  // Luggage
  const [luggageQty, setLuggageQty] = useState<Record<string, number>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentPercent, setPaymentPercent] = useState(100);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState("");

  const totalBags = calcTotalBags(luggageQty);
  const subtotal = calcSubtotal(luggageQty);
  const extraFee = calcExtraFee(totalBags);
  const servicesCost = ADDITIONAL_SERVICES.filter((s) => selectedServices[s.id]).reduce((sum, s) => sum + s.price, 0);
  const grandTotal = Math.max(0, subtotal + extraFee + servicesCost - promoDiscount);
  const downPayment = Math.ceil(grandTotal * (paymentPercent / 100));
  const excessBags = Math.max(0, totalBags - EXTRA_BAG_THRESHOLD);

  const storageDays =
    checkIn && checkOut
      ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const locs = Array.isArray(data) ? data : [];
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch(() => {});
    // Attempt to refresh full country list from API, fallback is already comprehensive
    setCountriesLoading(true);
    fetch("https://restcountries.com/v3.1/all?fields=name,cca2")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCountries(data.map((c: { name: { common: string } }) => c.name.common).sort((a: string, b: string) => a.localeCompare(b)));
        }
      })
      .catch(() => {})
      .finally(() => setCountriesLoading(false));
  }, []);

  useEffect(() => {
    if (!custCountry) return;
    fetch("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: custCountry }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          setCities(data.data.sort());
        } else {
          setCities(COUNTRY_CITY_FALLBACK[custCountry] || []);
        }
      })
      .catch(() => setCities(COUNTRY_CITY_FALLBACK[custCountry] || []))
      .finally(() => setCitiesLoading(false));
  }, [custCountry]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== 3) {
      toast.error("Please complete the booking details first");
      return;
    }
    setLoading(true);

    try {
      // Walk-in always creates a new customer record
      if (!custName.trim() || !custEmail.trim() || !custPhone.trim()) {
        toast.error("Please fill in customer name, email and phone");
        setLoading(false);
        return;
      }
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail.trim());
      if (!emailValid) {
        toast.error("Please enter a valid email address");
        setLoading(false);
        return;
      }
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: custName.trim(),
          email: custEmail.trim(),
          phone: custPhone.trim(),
          countryOfOrigin: custCountry || undefined,
          cityOfOrigin: custCity || undefined,
        }),
      });
      if (!custRes.ok) {
        const err = await custRes.json();
        toast.error(err.error || "Failed to create customer");
        setLoading(false);
        return;
      }
      const newCust = await custRes.json();
      const customerId = newCust.id;

      const luggageItems = JSON.parse(buildLuggageDetails(luggageQty));
      const selectedSvcList = ADDITIONAL_SERVICES.filter((s) => selectedServices[s.id]).map((s) => s.name);
      const luggageDetails = selectedSvcList.length > 0
        ? JSON.stringify([...luggageItems, { services: selectedSvcList }])
        : buildLuggageDetails(luggageQty);

      const pickupLocation = airline ? `${terminal} - ${airline}` : terminal;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          locationId: locationId || undefined,
          pickupLocation,
          dropOffLocation: dropOffTerminal || "Villamor, Pasay City",
          luggageDetails,
          checkIn: checkIn || new Date().toISOString(),
          checkOut: checkOut || undefined,
          numberOfBags: totalBags,
          totalPrice: grandTotal,
          servicesCost,
          paymentMethod,
          downPayment,
          promoCode: promoApplied || undefined,
          status: "CONFIRMED",
        }),
      });

      if (res.ok) {
        toast.success("Booking created successfully!");
        router.push("/dashboard/bookings");
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create booking");
      }
    } catch {
      toast.error("Failed to create booking");
    }
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 16);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/bookings"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Walk-in Booking</h1>
          <p className="text-sm text-muted-foreground">Create a booking for a walk-in customer</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: "Customer", icon: User },
          { num: 2, label: "Details", icon: Luggage },
          { num: 3, label: "Payment", icon: CreditCard },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                step === s.num
                  ? "bg-orange-500 text-white shadow-md"
                  : step > s.num
                    ? "bg-blue-100 text-blue-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-t-2 border-t-blue-500">
          <CardContent className="pt-6">
            {/* Step 1: Customer - Walk-in always new */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground rounded-lg border bg-blue-50/50 px-3 py-2">Walk-in booking — a new customer record will be created from the details below.</p>

                <div className="grid gap-4 md:grid-cols-2 rounded-lg border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="custName">Full Name <span className="text-red-500">*</span></Label>
                    <Input id="custName" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Juan Dela Cruz" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custEmail">Email <span className="text-red-500">*</span></Label>
                    <Input id="custEmail" type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="juan@email.com" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="custPhone">Phone <span className="text-red-500">*</span></Label>
                    <Input id="custPhone" type="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+63 912 345 6789" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custCountry">Country of Origin</Label>
                    <select
                      id="custCountry"
                      value={custCountry}
                      onChange={(e) => { setCustCountry(e.target.value); setCities([]); setCustCity(""); if (e.target.value) setCitiesLoading(true); }}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">Select country...</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custCity">City of Origin</Label>
                    <select
                      id="custCity"
                      value={custCity}
                      onChange={(e) => setCustCity(e.target.value)}
                      disabled={!custCountry || cities.length === 0}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm disabled:opacity-50"
                    >
                      <option value="">{countriesLoading || citiesLoading ? "Loading..." : custCountry ? "Select city..." : "Select country first"}</option>
                      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail.trim());
                      if (!custName.trim() || !custEmail.trim() || !custPhone.trim() || !emailOk) {
                        toast.error(!emailOk ? "Please enter a valid email address" : "Please fill in all required customer fields");
                        return;
                      }
                      setStep(2);
                    }}
                    disabled={!custName.trim() || !custEmail.trim() || !custPhone.trim()}
                  >
                    Next: Details
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Luggage & Details */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-blue-500" /> Pickup Terminal <span className="text-red-500">*</span></Label>
                    <select value={terminal} onChange={(e) => { setTerminal(e.target.value); setAirline(""); }} required className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                      <option value="">Select terminal...</option>
                      {NAIA_TERMINALS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Plane className="h-4 w-4 text-blue-500" /> Pickup Airline <span className="text-red-500">*</span></Label>
                    <select value={airline} onChange={(e) => setAirline(e.target.value)} required disabled={!terminal} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm disabled:opacity-50">
                      <option value="">{terminal ? "Select airline..." : "Select terminal first"}</option>
                      {getAirlinesForTerminal(terminal).map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {terminal && <p className="text-[10px] text-muted-foreground">Showing airlines available for {terminal}</p>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-indigo-500" /> Drop-off Location</Label>
                    <select value={dropOffTerminal} onChange={(e) => setDropOffTerminal(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                      <option value="Villamor, Pasay City">Dropnfly Counter (Villamor, Pasay City)</option>
                      {NAIA_TERMINALS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-500" /> Check-out (Delivery)</Label>
                    <Input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn || today} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-1">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-blue-500" /> Check-in (Pickup) <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} min={today} required />
                  </div>
                </div>

                {storageDays > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm text-blue-700">
                    <strong>Storage duration:</strong> {storageDays} day{storageDays > 1 ? "s" : ""} (from {new Date(checkIn).toLocaleString()} to {new Date(checkOut).toLocaleString()})
                  </div>
                )}

                <div>
                  <Label className="mb-3 flex items-center gap-1.5 text-base"><Package className="h-4 w-4 text-blue-500" /> Luggage Types</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {LUGGAGE_TYPES.map((lt) => {
                      const qty = luggageQty[lt.id] || 0;
                      return (
                        <div key={lt.id} className={`rounded-xl border-2 p-3 text-center transition-all ${qty > 0 ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <p className="text-sm font-bold">{lt.name}</p>
                          <p className="text-[10px] text-gray-500">{lt.dimensions}</p>
                          <p className="text-sm font-extrabold text-gray-800 mt-1">₱{lt.price}</p>
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => setLuggageQty((p) => ({ ...p, [lt.id]: Math.max(0, (p[lt.id] || 0) - 1) }))} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold">{qty}</span>
                            <button type="button" onClick={() => setLuggageQty((p) => ({ ...p, [lt.id]: (p[lt.id] || 0) + 1 }))} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalBags > 0 && (
                    <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-600">Total bags:</span><span className="font-bold">{totalBags}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-bold">₱{subtotal.toFixed(2)}</span></div>
                      {excessBags > 0 && (
                        <div className="flex justify-between text-amber-700"><span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Excess fee ({excessBags} × ₱{EXTRA_BAG_FEE.toFixed(2)})</span><span className="font-bold">+₱{extraFee.toFixed(2)}</span></div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="mb-2 flex items-center gap-1.5 text-sm"><Package className="h-4 w-4 text-violet-500" /> Additional Services</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ADDITIONAL_SERVICES.map((svc) => (
                      <label key={svc.id} className={`flex items-center justify-between rounded-lg border-2 p-3 transition-all cursor-pointer ${selectedServices[svc.id] ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={!!selectedServices[svc.id]} onCheckedChange={(c) => setSelectedServices((p) => ({ ...p, [svc.id]: !!c }))} />
                          <span className="text-sm font-medium">{svc.name}</span>
                        </div>
                        <span className="text-sm font-bold text-violet-700">+₱{svc.price}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button type="button" onClick={() => setStep(3)} disabled={totalBags === 0 || !terminal || !airline}>Next: Payment</Button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-gray-50/50 p-4 text-sm space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Summary</p>
                  <div className="flex justify-between"><span className="text-gray-600">Customer</span><span className="font-medium">{custName || "Walk-in"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Pickup</span><span className="font-medium">{terminal} - {airline}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Drop-off</span><span className="font-medium">{dropOffTerminal}</span></div>
                  {checkIn && <div className="flex justify-between"><span className="text-gray-600">Check-in</span><span className="font-medium">{new Date(checkIn).toLocaleString()}</span></div>}
                  {checkOut && <div className="flex justify-between"><span className="text-gray-600">Check-out</span><span className="font-medium">{new Date(checkOut).toLocaleString()}</span></div>}
                  {storageDays > 0 && <div className="flex justify-between text-blue-600"><span>Storage</span><span className="font-medium">{storageDays} day{storageDays > 1 ? "s" : ""}</span></div>}
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between"><span className="text-gray-600">Luggage ({totalBags} bags)</span><span className="font-medium">₱{subtotal.toFixed(2)}</span></div>
                    {excessBags > 0 && <div className="flex justify-between text-amber-600"><span>Excess fee ({excessBags} × ₱{EXTRA_BAG_FEE.toFixed(2)})</span><span>+₱{extraFee.toFixed(2)}</span></div>}
                    {servicesCost > 0 && <div className="flex justify-between text-violet-600"><span>Services</span><span>+₱{servicesCost.toFixed(2)}</span></div>}
                    {promoApplied && <div className="flex justify-between text-green-600"><span>Promo ({promoApplied})</span><span>-₱{promoDiscount.toFixed(2)}</span></div>}
                    <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total</span><span>₱{grandTotal.toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm">
                  <Label className="mb-1 block">Payment Option</Label>
                  <p className="mb-3 text-xs text-blue-700">Slide to choose how much to collect now. Minimum of <strong>50%</strong>.</p>
                  <div className="mb-3 flex items-center gap-4">
                    <input
                      type="range"
                      min={50}
                      max={100}
                      step={5}
                      value={paymentPercent}
                      onChange={(e) => setPaymentPercent(Number(e.target.value))}
                      className="w-full accent-blue-600"
                      aria-label="Down payment percentage"
                    />
                    <span className="shrink-0 rounded-lg border border-blue-200 bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700 tabular-nums">
                      {paymentPercent}%
                    </span>
                  </div>
                  <div className="mb-1 flex justify-between text-[10px] font-medium text-blue-500">
                    <span>50% (minimum)</span>
                    <span>100%</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-blue-800"><span>Collect now</span><span className="font-bold">₱{downPayment.toFixed(2)}</span></div>
                    {paymentPercent < 100 && <div className="flex justify-between text-blue-600"><span>Collect later (remaining)</span><span className="font-medium">₱{(grandTotal - downPayment).toFixed(2)}</span></div>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Promo Code</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Enter promo code"
                    />
                    <Button type="button" variant="outline" onClick={async () => {
                      setPromoError(""); setPromoDiscount(0); setPromoApplied("");
                      if (!promoCode) return;
                      try {
                        const res = await fetch("/api/promo-codes/validate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code: promoCode, amount: subtotal + extraFee + servicesCost }),
                        });
                        const data = await res.json();
                        if (data.valid) { setPromoDiscount(data.discount); setPromoApplied(promoCode); setPromoCode(""); }
                        else setPromoError(data.error || "Invalid promo code");
                      } catch { setPromoError("Failed to validate"); }
                    }}>Apply</Button>
                  </div>
                  {promoApplied && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2 text-sm text-green-700">
                      <span>Promo &quot;{promoApplied}&quot; applied! Discount: &#x20B1;{promoDiscount.toFixed(2)}</span>
                      <button type="button" onClick={() => { setPromoApplied(""); setPromoDiscount(0); }} className="ml-auto text-green-500 hover:text-green-700">Remove</button>
                    </div>
                  )}
                  {promoError && <p className="text-sm text-red-500">{promoError}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                    <option value="CASH">Cash</option>
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" disabled={loading || totalBags === 0}>
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
