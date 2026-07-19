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

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const NAIA_TERMINALS = [
  { value: "NAIA Terminal 1", label: "Terminal 1" },
  { value: "NAIA Terminal 2", label: "Terminal 2" },
  { value: "NAIA Terminal 3", label: "Terminal 3" },
  { value: "NAIA Terminal 4", label: "Terminal 4" },
];

const AIRLINES = [
  "Philippine Airlines", "Cebu Pacific", "AirAsia Philippines", "Emirates",
  "Qatar Airways", "Singapore Airlines", "Cathay Pacific", "Korean Air",
  "Japan Airlines", "Turkish Airlines", "Etihad Airways", "United Airlines",
];

const ADDITIONAL_SERVICES = [
  { id: "pick-up-from-customer", name: "Pick-up from Customer", price: 180 },
  { id: "deliver-to-customer", name: "Deliver to Customer", price: 180 },
] as const;

export default function NewBookingPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Customer fields
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Terminal/Airline
  const [terminal, setTerminal] = useState("");
  const [airline, setAirline] = useState("");

  // Location
  const [locationId, setLocationId] = useState("");

  // Schedule
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  // Luggage
  const [luggageQty, setLuggageQty] = useState<Record<string, number>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [fullPayment, setFullPayment] = useState(true);

  const totalBags = calcTotalBags(luggageQty);
  const subtotal = calcSubtotal(luggageQty);
  const extraFee = calcExtraFee(totalBags);
  const servicesCost = ADDITIONAL_SERVICES.filter((s) => selectedServices[s.id]).reduce((sum, s) => sum + s.price, 0);
  const grandTotal = subtotal + extraFee + servicesCost;
  const downPayment = fullPayment ? grandTotal : Math.ceil(grandTotal * 0.5);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch("/api/locations")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const locs = Array.isArray(data) ? data : [];
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch(() => {});
  }, []);

  function handleCustomerSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "__new__") {
      setIsNewCustomer(true);
      setSelectedCustomerId("");
      setCustName("");
      setCustEmail("");
      setCustPhone("");
    } else {
      setIsNewCustomer(false);
      setSelectedCustomerId(val);
      const cust = customers.find((c) => c.id === val);
      if (cust) {
        setCustName(cust.name);
        setCustEmail(cust.email);
        setCustPhone(cust.phone);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      let customerId = selectedCustomerId;

      // Create new customer if needed
      if (isNewCustomer && custName && custEmail && custPhone) {
        const custRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: custName, email: custEmail, phone: custPhone }),
        });
        if (!custRes.ok) {
          const err = await custRes.json();
          toast.error(err.error || "Failed to create customer");
          setLoading(false);
          return;
        }
        const newCust = await custRes.json();
        customerId = newCust.id;
      }

      if (!customerId) {
        toast.error("Please select or create a customer");
        setLoading(false);
        return;
      }

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
          dropOffLocation: pickupLocation || "Villamor, Pasay City",
          luggageDetails,
          checkIn: checkIn || new Date().toISOString(),
          checkOut: checkOut || undefined,
          numberOfBags: totalBags,
          totalPrice: grandTotal,
          servicesCost,
          paymentMethod,
          downPayment: fullPayment ? grandTotal : downPayment,
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
                  ? "bg-blue-600 text-white shadow-md"
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
            {/* Step 1: Customer */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <select
                    value={isNewCustomer ? "__new__" : selectedCustomerId}
                    onChange={handleCustomerSelect}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="">Choose a customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                    ))}
                    <option value="__new__">+ New Customer (Walk-in)</option>
                  </select>
                </div>

                {(isNewCustomer || !selectedCustomerId) && (
                  <div className="grid gap-4 md:grid-cols-2 rounded-lg border bg-muted/30 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="custName">Full Name <span className="text-red-500">*</span></Label>
                      <Input id="custName" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Juan Dela Cruz" required={isNewCustomer} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custEmail">Email <span className="text-red-500">*</span></Label>
                      <Input id="custEmail" type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="juan@email.com" required={isNewCustomer} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="custPhone">Phone <span className="text-red-500">*</span></Label>
                      <Input id="custPhone" type="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+63 912 345 6789" required={isNewCustomer} />
                    </div>
                  </div>
                )}

                {selectedCustomerId && !isNewCustomer && custName && (
                  <div className="rounded-lg border bg-green-50 p-3 text-sm text-green-700">
                    <span className="font-medium">{custName}</span> selected ({custEmail})
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="button" onClick={() => setStep(2)} disabled={!selectedCustomerId && !isNewCustomer}>
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
                    <Label className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-blue-500" /> Terminal <span className="text-red-500">*</span></Label>
                    <select value={terminal} onChange={(e) => setTerminal(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                      <option value="">Select terminal...</option>
                      {NAIA_TERMINALS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Plane className="h-4 w-4 text-blue-500" /> Airline <span className="text-red-500">*</span></Label>
                    <select value={airline} onChange={(e) => setAirline(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                      <option value="">Select airline...</option>
                      {AIRLINES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-blue-500" /> Check-in (Pickup) <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} min={today} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-500" /> Check-out (Delivery)</Label>
                    <Input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn || today} />
                  </div>
                </div>

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
                      {totalBags > EXTRA_BAG_THRESHOLD && (
                        <div className="flex justify-between text-amber-700"><span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Excess fee</span><span className="font-bold">+₱{EXTRA_BAG_FEE.toFixed(2)}</span></div>
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
                  <div className="flex justify-between"><span className="text-gray-600">Terminal</span><span className="font-medium">{terminal} - {airline}</span></div>
                  {checkIn && <div className="flex justify-between"><span className="text-gray-600">Check-in</span><span className="font-medium">{new Date(checkIn).toLocaleString()}</span></div>}
                  {checkOut && <div className="flex justify-between"><span className="text-gray-600">Check-out</span><span className="font-medium">{new Date(checkOut).toLocaleString()}</span></div>}
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between"><span className="text-gray-600">Luggage ({totalBags} bags)</span><span className="font-medium">₱{subtotal.toFixed(2)}</span></div>
                    {extraFee > 0 && <div className="flex justify-between text-amber-600"><span>Excess fee</span><span>+₱{extraFee.toFixed(2)}</span></div>}
                    {servicesCost > 0 && <div className="flex justify-between text-violet-600"><span>Services</span><span>+₱{servicesCost.toFixed(2)}</span></div>}
                    <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total</span><span>₱{grandTotal.toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Payment Option</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFullPayment(true)} className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-all ${fullPayment ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 hover:border-blue-300"}`}>Full Payment</button>
                    <button type="button" onClick={() => setFullPayment(false)} className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-all ${!fullPayment ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 hover:border-blue-300"}`}>50% Down</button>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-3 text-sm space-y-1">
                    <div className="flex justify-between text-blue-800"><span>Pay now</span><span className="font-bold">₱{downPayment.toFixed(2)}</span></div>
                    {!fullPayment && <div className="flex justify-between text-blue-600"><span>Collect later</span><span className="font-medium">₱{(grandTotal - downPayment).toFixed(2)}</span></div>}
                  </div>
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
