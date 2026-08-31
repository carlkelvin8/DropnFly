"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Check, User, MapPin, Luggage, Wrench, Search } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { FALLBACK_COUNTRIES, FALLBACK_CITIES } from "@/components/booking/constants";

const ContactStep = lazy(() => import("@/components/booking/ContactStep").then((m) => ({ default: m.ContactStep })));
const PickupStep = lazy(() => import("@/components/booking/PickupStep").then((m) => ({ default: m.PickupStep })));
const LuggageStep = lazy(() => import("@/components/booking/LuggageStep").then((m) => ({ default: m.LuggageStep })));
const PaymentStep = lazy(() => import("@/components/booking/PaymentStep").then((m) => ({ default: m.PaymentStep })));
const BookingModals = lazy(() => import("@/components/booking/BookingModals").then((m) => ({ default: m.BookingModals })));

const StepFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center space-y-3">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading step...</p>
    </div>
  </div>
);

interface TimeSlot {
  start: string;
  end: string;
  booked: number;
  available: boolean;
  unavailableReason?: "past" | "full" | null;
}

const steps = [
  { num: 1, label: "Contact", icon: User },
  { num: 2, label: "Pickup", icon: MapPin },
  { num: 3, label: "Delivery & Luggage", icon: Luggage },
  { num: 4, label: "Payment", icon: Check },
];

function calcStorageDays(pickupDate: string, pickupSlot: string, deliveryDate: string, deliverySlot: string): number {
  if (!pickupDate || !pickupSlot || !deliveryDate || !deliverySlot) return 0;
  const start = new Date(`${pickupDate}T${pickupSlot}:00`);
  const end = new Date(`${deliveryDate}T${deliverySlot}:00`);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function BookPage() {
  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
  const paymentDemoMode = !paymentsEnabled;
  const router = useRouter();
  const submittingRef = useRef(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState("");
  const [promoError, setPromoError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupSlot, setPickupSlot] = useState("");
  const [pickupSlots, setPickupSlots] = useState<TimeSlot[]>([]);
  const [pickupSlotsLoading, setPickupSlotsLoading] = useState(false);
  const [pickupTerminal, setPickupTerminal] = useState("");
  const [pickupAirline, setPickupAirline] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [deliverySlots, setDeliverySlots] = useState<TimeSlot[]>([]);
  const [deliverySlotsLoading, setDeliverySlotsLoading] = useState(false);
  const [deliveryTerminal, setDeliveryTerminal] = useState("");
  const [luggageQty, setLuggageQty] = useState<Record<string, number>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [paymentPercent, setPaymentPercent] = useState(50);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsPopup, setShowTermsPopup] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [fees, setFees] = useState({ pickupFee: 180, deliveryFee: 180, excessBagFee: 100, excessBagThreshold: 3 });
  const [minDpPercent, setMinDpPercent] = useState(50);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);
  const [onlineBookingEnabled, setOnlineBookingEnabled] = useState(true);
  const [discountCodesEnabled, setDiscountCodesEnabled] = useState(true);
  const [luggagePrices, setLuggagePrices] = useState<Record<string, number>>({ "extra-small": 50, small: 150, standard: 175, large: 250 });
  const [maxBags, setMaxBags] = useState(10);
  const [countries, setCountries] = useState<{ name: string; code: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [slotRefreshTick, setSlotRefreshTick] = useState(0);

  const totalBags = luggageQty ? Object.values(luggageQty).reduce((s, n) => s + (n || 0), 0) : 0;
  const storageDays = calcStorageDays(pickupDate, pickupSlot, deliveryDate, deliverySlot);
  const totalSteps = steps.length;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  function nextStep() { setStep((s) => Math.min(s + 1, totalSteps)); }
  function prevStep() { setStep((s) => Math.max(s - 1, 1)); }

  // Changing a date invalidates any previously selected time slot.
  function updatePickupDate(date: string) {
    setPickupDate(date);
    setPickupSlot("");
  }
  function updateDeliveryDate(date: string) {
    setDeliveryDate(date);
    setDeliverySlot("");
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch("https://restcountries.com/v3.1/all?fields=name,cca2", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const countriesByName = new Map(
            FALLBACK_COUNTRIES.map((name) => [name.toLocaleLowerCase(), { name, code: name }])
          );
          for (const country of data as { name: { common: string }; cca2: string }[]) {
            countriesByName.set(country.name.common.toLocaleLowerCase(), { name: country.name.common, code: country.cca2 });
          }
          setCountries([...countriesByName.values()].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setCountries(FALLBACK_COUNTRIES.map((name) => ({ name, code: name })).sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
      .catch(() => setCountries(FALLBACK_COUNTRIES.map((name) => ({ name, code: name })).sort((a, b) => a.name.localeCompare(b.name))))
      .finally(() => { clearTimeout(timeout); setCountriesLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: selectedCountry }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.data) && data.data.length > 0) setCities(data.data.sort());
        else setCities(FALLBACK_CITIES[selectedCountry] || []);
      })
      .catch(() => setCities(FALLBACK_CITIES[selectedCountry] || []))
      .finally(() => { clearTimeout(timeout); setCitiesLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [selectedCountry]);

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        setMaintenance(data.maintenance || { enabled: false, message: "" });
        setOnlineBookingEnabled(data.features?.online_booking_enabled !== false);
        setDiscountCodesEnabled(data.features?.discount_codes_enabled !== false);
        if (data.luggage_prices) setLuggagePrices(data.luggage_prices);
        if (data.booking_limits?.max_bags_per_booking > 0) setMaxBags(data.booking_limits.max_bags_per_booking);
        if (data.pricing) {
          setFees({
            pickupFee: data.pricing.pickup_fee || 180,
            deliveryFee: data.pricing.delivery_fee || 180,
            excessBagFee: data.pricing.excess_bag_fee || 100,
            excessBagThreshold: data.pricing.excess_bag_threshold || 3,
          });
        }
        if (data.booking_limits && data.booking_limits.min_dp_percentage > 0) {
          setMinDpPercent(Math.min(100, data.booking_limits.min_dp_percentage));
          setPaymentPercent(Math.max(50, Math.min(100, data.booking_limits.min_dp_percentage)));
        }
      })
      .catch(() => {});
  }, []);

  const fetchSlots = useCallback(async (date: string, type: "pickup" | "delivery"): Promise<TimeSlot[]> => {
    if (!date) return [];
    try {
      const res = await fetch(`/api/public/time-slots?date=${date}&type=${type}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.slots || [];
    } catch { return []; }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSlotRefreshTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pickupDate) return;
    fetchSlots(pickupDate, "pickup").then((slots) => {
      setPickupSlots(slots);
      setPickupSlot((selected) => selected && !slots.some((slot) => slot.start === selected && slot.available) ? "" : selected);
      setPickupSlotsLoading(false);
    });
  }, [pickupDate, fetchSlots, slotRefreshTick]);

  useEffect(() => {
    if (!deliveryDate) return;
    fetchSlots(deliveryDate, "delivery").then((slots) => {
      setDeliverySlots(slots);
      setDeliverySlot((selected) => selected && !slots.some((slot) => slot.start === selected && slot.available) ? "" : selected);
      setDeliverySlotsLoading(false);
    });
  }, [deliveryDate, fetchSlots, slotRefreshTick]);

  function getPickupLocationText() {
    let text = pickupTerminal;
    if (pickupAirline) text += ` - ${pickupAirline}`;
    return text;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!acceptedTerms) { setShowTermsPopup(true); submittingRef.current = false; return; }
    setLoading(true);
    setError("");

    const pickupDateTime = `${pickupDate}T${pickupSlot}:00+08:00`;
    const deliveryDateTime = deliveryDate && deliverySlot ? `${deliveryDate}T${deliverySlot}:00+08:00` : "";

    const { calcSubtotal, calcTotalBags, buildLuggageDetails } = await import("@/lib/luggage-types");
    const luggageItems = JSON.parse(buildLuggageDetails(luggageQty, luggagePrices));
    const servicesList = [
      { id: "pick-up-from-customer", name: "Pick-up from Customer", price: fees.pickupFee },
      { id: "deliver-to-customer", name: "Deliver to Customer", price: fees.deliveryFee },
    ];
    const selectedSvcList = servicesList.filter((s) => selectedServices[s.id]).map((s) => s.name);
    const luggageDetailsPayload = selectedSvcList.length > 0
      ? JSON.stringify([...luggageItems, { services: selectedSvcList }])
      : buildLuggageDetails(luggageQty, luggagePrices);

    const subtotal = calcSubtotal(luggageQty, luggagePrices) * Math.max(1, storageDays);
    const numBags = calcTotalBags(luggageQty);
    const extraFee = numBags > fees.excessBagThreshold ? (numBags - fees.excessBagThreshold) * fees.excessBagFee : 0;
    const servicesCost = servicesList.filter((s) => selectedServices[s.id]).reduce((sum, s) => sum + s.price, 0);
    const grandTotal = Math.max(0, subtotal + extraFee + servicesCost - promoDiscount);
    const downPayment = paymentsEnabled ? Math.ceil(grandTotal * (paymentPercent / 100)) : 0;

    const data = {
      name: customerName.trim(),
      email: customerEmail.trim(),
      phone: customerPhone.trim(),
      countryOfOrigin: selectedCountry || undefined,
      cityOfOrigin: selectedCity || undefined,
      pickupLocation: getPickupLocationText(),
      dropOffLocation: deliveryTerminal || "",
      numberOfBags: String(numBags),
      luggageDetails: luggageDetailsPayload,
      preferredDate: pickupDateTime,
      deliveryDate: deliveryDateTime || undefined,
      promoCode: promoApplied || undefined,
      totalPrice: grandTotal,
      downPayment,
    };

    let res: Response;
    try {
      res = await fetch("/api/public/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (!res.ok) {
      try { const err = await res.json(); setError(err.error || "Something went wrong"); }
      catch { setError("Something went wrong"); }
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    const result = await res.json();
    if (!paymentDemoMode && result.paymentAmount > 0) {
      const checkout = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: result.bookingId, amount: result.paymentAmount }),
      }).catch(() => null);
      if (checkout?.ok) {
        const payment = await checkout.json();
        if (payment.url) { window.location.assign(payment.url); return; }
      }
      // Checkout failed — show error with retry option
      setError("Payment setup failed. Your booking is confirmed but payment was not processed. Please contact support or retry your payment.");
      setLoading(false);
      submittingRef.current = false;
      return;
    }
    const emailState = result.confirmationEmailSent ? "sent" : "failed";
    router.push(`/book/confirm/${result.referenceNumber}?email=${emailState}`);
  }

  function handleNextStep() {
    const errors: string[] = [];
    if (step === 1) {
      if (!customerName.trim()) errors.push("Please enter your Full Name");
      if (!customerEmail.trim()) errors.push("Please enter your Email Address");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) errors.push("Please enter a valid Email Address");
      if (!customerPhone.trim()) errors.push("Please enter your Phone Number");
      else if (!/^\+?[0-9\s\-()]{7,20}$/.test(customerPhone.trim())) errors.push("Please enter a valid Phone Number");
      if (!selectedCountry) errors.push("Please select your Country of Origin");
      if (!selectedCity) errors.push("Please select your City of Origin");
    } else if (step === 2) {
      if (!pickupDate) errors.push("Please select your Pickup Date");
      if (!pickupSlot) errors.push("Please select your Pickup Time Slot");
      if (!pickupTerminal) errors.push("Please select your Pickup Terminal");
      if (!pickupAirline) errors.push("Please select your Airline Carrier");
      if (!deliveryTerminal) errors.push("Please select your Drop-off Terminal");
      if (!deliveryDate) errors.push("Please select your Delivery Date");
      if (!deliverySlot) errors.push("Please select your Delivery Time Slot");
    } else if (step === 3) {
      if (totalBags === 0) errors.push("Please select at least one bag (Luggage Types)");
    }
    if (errors.length > 0) { setError(errors.join(". ")); return; }
    setError("");
    nextStep();
  }

  if (maintenance?.enabled || !onlineBookingEnabled) {
    return (
      <div className="min-h-screen bg-blue-50/50">
        <PublicHeader showBackToHome />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 shadow-lg shadow-amber-200">
            <Wrench className="h-10 w-10 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Under Maintenance</h1>
          <p className="mt-3 text-muted-foreground">{maintenance?.enabled ? (maintenance.message || "We are currently undergoing scheduled maintenance. Please check back shortly.") : "Online booking is temporarily disabled. Please contact DropnFly staff for assistance."}</p>
          <Link href="/track" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-blue-700">
            <Search className="h-4 w-4" /> Track Existing Booking
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/50">
      <PublicHeader showBackToHome />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-700">Book a Pickup</h1>
          <p className="mt-2 text-muted-foreground">Schedule your luggage pickup. No registration needed.</p>
        </div>

        <div className="mb-8">
          <div className="relative">
            <div className="h-2 w-full rounded-full bg-border">
              <div className="h-2 rounded-full bg-orange-500 transition-[width] duration-500 ease-in-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between">
              {steps.map((s) => {
                const Icon = s.icon;
                const isActive = step >= s.num;
                const isCurrent = step === s.num;
                return (
                  <div key={s.num} className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${isActive ? "bg-orange-500 text-white shadow-md" : "bg-border text-muted-foreground/60"} ${isCurrent ? "ring-4 ring-blue-200" : ""}`}>
                      {isActive && step > s.num ? <Check className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : s.num}
                    </div>
                    <span className={`mt-1.5 text-[11px] font-medium ${isCurrent ? "text-blue-700" : isActive ? "text-blue-500" : "text-muted-foreground/60"}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <Suspense fallback={<StepFallback />}>
                  <ContactStep
                    customerName={customerName} setCustomerName={setCustomerName}
                    customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
                    customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
                    selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry}
                    selectedCity={selectedCity} setSelectedCity={setSelectedCity}
                    countries={countries} cities={cities}
                    countriesLoading={countriesLoading} citiesLoading={citiesLoading}
                    setCities={setCities} error={error} onNext={handleNextStep}
                  />
                </Suspense>
              )}
              {step === 2 && (
                <Suspense fallback={<StepFallback />}>
                  <PickupStep
                    pickupTerminal={pickupTerminal} setPickupTerminal={setPickupTerminal}
                    setPickupAirline={setPickupAirline} pickupAirline={pickupAirline}
                    pickupDate={pickupDate} setPickupDate={updatePickupDate}
                    setPickupSlotsLoading={setPickupSlotsLoading}
                    pickupSlots={pickupSlots} pickupSlotsLoading={pickupSlotsLoading}
                    pickupSlot={pickupSlot} setPickupSlot={setPickupSlot}
                    deliveryTerminal={deliveryTerminal} setDeliveryTerminal={setDeliveryTerminal}
                    deliveryDate={deliveryDate} setDeliveryDate={updateDeliveryDate}
                    setDeliverySlotsLoading={setDeliverySlotsLoading}
                    deliverySlots={deliverySlots} deliverySlotsLoading={deliverySlotsLoading}
                    deliverySlot={deliverySlot} setDeliverySlot={setDeliverySlot}
                    storageDays={storageDays} error={error} onNext={handleNextStep} onPrev={prevStep}
                  />
                </Suspense>
              )}
              {step === 3 && (
                <Suspense fallback={<StepFallback />}>
                  <LuggageStep
                    luggageQty={luggageQty} setLuggageQty={setLuggageQty}
                    selectedServices={selectedServices} setSelectedServices={setSelectedServices}
                    fees={fees} luggagePrices={luggagePrices} maxBags={maxBags} storageDays={storageDays}
                    onNext={handleNextStep} onPrev={prevStep}
                  />
                </Suspense>
              )}
              {step === 4 && (
                <Suspense fallback={<StepFallback />}>
                  <PaymentStep
                    pickupDate={pickupDate} pickupSlot={pickupSlot}
                    pickupTerminal={pickupTerminal} pickupAirline={pickupAirline}
                    deliveryTerminal={deliveryTerminal} deliveryDate={deliveryDate} deliverySlot={deliverySlot}
                    luggageQty={luggageQty} selectedServices={selectedServices} fees={fees}
                    luggagePrices={luggagePrices} discountCodesEnabled={discountCodesEnabled}
                    promoCode={promoCode} setPromoCode={setPromoCode}
                    promoApplied={promoApplied} setPromoApplied={setPromoApplied}
                    promoDiscount={promoDiscount} setPromoDiscount={setPromoDiscount}
                    promoError={promoError} setPromoError={setPromoError}
                    paymentPercent={paymentPercent} setPaymentPercent={setPaymentPercent}
                    acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms}
                    error={error} loading={loading} storageDays={storageDays}
                    paymentDemoMode={paymentDemoMode} minDpPercent={minDpPercent}
                    onPrev={prevStep}
                    onShowTermsModal={() => setShowTermsModal(true)}
                    onShowPrivacyModal={() => setShowPrivacyModal(true)}
                  />
                </Suspense>
              )}
            </form>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={showTermsPopup}
          onClose={() => setShowTermsPopup(false)}
          onConfirm={() => { setShowTermsPopup(false); setAcceptedTerms(true); }}
          title="Terms & Conditions Required"
          message="Please read and accept the Terms & Conditions and Privacy Policy to proceed with your booking."
          confirmLabel="Accept & Continue"
          variant="warning"
        />

        <Suspense fallback={null}>
          <BookingModals
            termsOpen={showTermsModal}
            privacyOpen={showPrivacyModal}
            onTermsClose={() => setShowTermsModal(false)}
            onPrivacyClose={() => setShowPrivacyModal(false)}
          />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
