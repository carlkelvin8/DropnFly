"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  User,
  MapPin,
  Luggage,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Plane,
  Building2,
  Navigation,
  Package,
  Minus,
  Plus,
  AlertTriangle,
  Info,
  Wrench,
  Search,
} from "lucide-react";
import { LUGGAGE_TYPES, calcSubtotal, calcTotalBags, buildLuggageDetails, type LuggageType } from "@/lib/luggage-types";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

interface TimeSlot {
  start: string;
  end: string;
  booked: number;
  available: boolean;
}

const NAIA_TERMINALS = [
  { value: "NAIA Terminal 1", label: "NAIA Terminal 1 (Ninoy Aquino International Airport)" },
  { value: "NAIA Terminal 2", label: "NAIA Terminal 2 (Centennial Terminal)" },
  { value: "NAIA Terminal 3", label: "NAIA Terminal 3" },
  { value: "NAIA Terminal 4", label: "NAIA Terminal 4 (Manila Domestic Airport)" },
];

const NAIA_TERMINAL_COORDS: Record<string, { lat: number; lng: number }> = {
  "NAIA Terminal 1": { lat: 14.5106, lng: 121.0197 },
  "NAIA Terminal 2": { lat: 14.5118, lng: 121.0143 },
  "NAIA Terminal 3": { lat: 14.5186, lng: 121.0188 },
  "NAIA Terminal 4": { lat: 14.5081, lng: 121.0147 },
};

const AIRLINES = [
  "Philippine Airlines",
  "PAL Express",
  "Cebu Pacific",
  "AirAsia Philippines",
  "AirSWIFT",
  "Emirates",
  "Qatar Airways",
  "Singapore Airlines",
  "Cathay Pacific",
  "Korean Air",
  "Japan Airlines",
  "Turkish Airlines",
  "Etihad Airways",
  "Thai Airways",
  "EVA Air",
  "China Airlines",
  "Delta Air Lines",
  "United Airlines",
];

const FALLBACK_COUNTRIES = [
  "Philippines", "United States", "United Kingdom", "United Arab Emirates", "Qatar",
  "Singapore", "Japan", "South Korea", "China", "Taiwan", "Hong Kong", "Thailand",
  "Vietnam", "Indonesia", "Malaysia", "Australia", "New Zealand", "Canada", "France",
  "Germany", "Italy", "Spain", "Netherlands", "Switzerland", "Saudi Arabia", "Kuwait",
  "Bahrain", "Oman", "India", "Bangladesh", "Pakistan", "Sri Lanka", "Nepal",
];

const FALLBACK_CITIES: Record<string, string[]> = {
  "Philippines": ["Manila", "Quezon City", "Makati", "Taguig", "Pasay", "Parañaque", "Cebu City", "Davao City", "Iloilo City", "Baguio City"],
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "San Francisco", "Seattle", "Las Vegas", "Miami"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "Qatar": ["Doha"],
  "Singapore": ["Singapore"],
  "Japan": ["Tokyo", "Osaka", "Nagoya", "Fukuoka"],
  "South Korea": ["Seoul", "Busan", "Incheon"],
  "China": ["Beijing", "Shanghai", "Guangzhou", "Xiamen"],
  "Taiwan": ["Taipei", "Kaohsiung"],
  "Hong Kong": ["Hong Kong"],
  "Thailand": ["Bangkok", "Phuket", "Chiang Mai"],
  "Vietnam": ["Hanoi", "Ho Chi Minh City"],
  "Indonesia": ["Jakarta", "Bali"],
  "Malaysia": ["Kuala Lumpur", "Penang"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth"],
  "Canada": ["Toronto", "Vancouver", "Montreal"],
  "France": ["Paris", "Nice"],
  "Germany": ["Berlin", "Frankfurt", "Munich"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
};


const steps = [
  { num: 1, label: "Contact", icon: User },
  { num: 2, label: "Pickup", icon: MapPin },
  { num: 3, label: "Delivery & Luggage", icon: Luggage },
  { num: 4, label: "Payment", icon: Check },
];

const today = () => new Date().toISOString().split("T")[0];

function SuitcaseIllustration({ type, qty }: { type: LuggageType; qty: number }) {
  const scaleMap: Record<string, number> = { "extra-small": 0.7, small: 0.85, standard: 1, large: 1.15 };
  const scale = scaleMap[type.id] || 1;
  return (
    <svg width={56 * scale} height={48 * scale} viewBox="0 0 56 48" fill="none" className={`transition-all ${qty > 0 ? "opacity-100" : "opacity-60"}`}>
      <rect x="6" y="10" width="44" height="30" rx="4" className={qty > 0 ? "fill-blue-600/20 stroke-blue-600" : "fill-gray-100 stroke-gray-400"} strokeWidth="1.5" />
      <rect x="22" y="6" width="12" height="4" rx="1.5" className={qty > 0 ? "fill-blue-600/30 stroke-blue-600" : "fill-gray-200 stroke-gray-400"} strokeWidth="1.2" />
      <rect x="24" y="24" width="8" height="10" rx="1" className={qty > 0 ? "fill-blue-600/40" : "fill-gray-300"} />
      <circle cx="28" cy="29" r="2" fill="white" opacity="0.6" />
      <line x1="10" y1="20" x2="18" y2="20" className={qty > 0 ? "stroke-blue-500/40" : "stroke-gray-300"} strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="24" x2="15" y2="24" className={qty > 0 ? "stroke-blue-500/40" : "stroke-gray-300"} strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="28" x2="18" y2="28" className={qty > 0 ? "stroke-blue-500/40" : "stroke-gray-300"} strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="32" x2="14" y2="32" className={qty > 0 ? "stroke-blue-500/40" : "stroke-gray-300"} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function calcStorageDays(pickupDate: string, pickupSlot: string, deliveryDate: string, deliverySlot: string): number {
  if (!pickupDate || !pickupSlot || !deliveryDate || !deliverySlot) return 0;
  const start = new Date(`${pickupDate}T${pickupSlot}:00`);
  const end = new Date(`${deliveryDate}T${deliverySlot}:00`);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function BookPage() {
  const paymentDemoMode = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED !== "true";
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState("");
  const [promoError, setPromoError] = useState("");

  const [pickupDate, setPickupDate] = useState("");
  const [pickupSlot, setPickupSlot] = useState("");
  const [pickupSlots, setPickupSlots] = useState<TimeSlot[]>([]);
  const [pickupSlotsLoading, setPickupSlotsLoading] = useState(false);
  const [pickupTerminal, setPickupTerminal] = useState("");
  const [pickupAirline, setPickupAirline] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [deliverySlots, setDeliverySlots] = useState<TimeSlot[]>([]);
  const [deliverySlotsLoading, setDeliverySlotsLoading] = useState(false);
  const [deliveryTerminal, setDeliveryTerminal] = useState("");
  const [luggageQty, setLuggageQty] = useState<Record<string, number>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [paymentPercent, setPaymentPercent] = useState(50);
  const [paymentHover, setPaymentHover] = useState<number | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsPopup, setShowTermsPopup] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [fees, setFees] = useState({ pickupFee: 180, deliveryFee: 180, excessBagFee: 100, excessBagThreshold: 3 });
  const [minDpPercent, setMinDpPercent] = useState(50);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);

  const [countries, setCountries] = useState<{ name: string; code: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const totalBags = calcTotalBags(luggageQty);
  const subtotal = calcSubtotal(luggageQty);
  const extraFee = totalBags > fees.excessBagThreshold ? (totalBags - fees.excessBagThreshold) * fees.excessBagFee : 0;
  const servicesList = [
    { id: "pick-up-from-customer", name: "Pick-up from Customer", description: "Rider picks up luggage from your location", price: fees.pickupFee },
    { id: "deliver-to-customer", name: "Deliver to Customer", description: "Rider delivers luggage to your location", price: fees.deliveryFee },
  ];
  const servicesCost = servicesList.filter((s) => selectedServices[s.id]).reduce((sum, s) => sum + s.price, 0);
  const grandTotal = Math.max(0, subtotal + extraFee + servicesCost - promoDiscount);
  const downPayment = paymentDemoMode ? 0 : Math.ceil(grandTotal * (paymentPercent / 100));
  const remainingBalance = grandTotal - downPayment;
  const storageDays = calcStorageDays(pickupDate, pickupSlot, deliveryDate, deliverySlot);
  const dpMin = Math.max(50, Math.min(100, minDpPercent || 50));

  const totalSteps = steps.length;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  function nextStep() { setStep((s) => Math.min(s + 1, totalSteps)); }
  function prevStep() { setStep((s) => Math.max(s - 1, 1)); }

  useEffect(() => {
    fetch("https://restcountries.com/v3.1/all?fields=name,cca2")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const list = data
            .map((c: { name: { common: string }; cca2: string }) => ({ name: c.name.common, code: c.cca2 }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
          setCountries(list);
        } else {
          setCountries(FALLBACK_COUNTRIES.map((name) => ({ name, code: name })));
        }
      })
      .catch(() => setCountries(FALLBACK_COUNTRIES.map((name) => ({ name, code: name }))))
      .finally(() => setCountriesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    fetch("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: selectedCountry }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          setCities(data.data.sort());
        } else {
          setCities(FALLBACK_CITIES[selectedCountry] || []);
        }
      })
      .catch(() => setCities(FALLBACK_CITIES[selectedCountry] || []))
      .finally(() => setCitiesLoading(false));
  }, [selectedCountry]);

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        setMaintenance(data.maintenance || { enabled: false, message: "" });
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

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPickupLat(pos.coords.latitude);
          setPickupLng(pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

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
    if (!pickupDate) return;
    fetchSlots(pickupDate, "pickup").then((slots) => {
      setPickupSlots(slots);
      setPickupSlotsLoading(false);
    });
  }, [pickupDate, fetchSlots]);

  useEffect(() => {
    if (!deliveryDate) return;
    fetchSlots(deliveryDate, "delivery").then((slots) => {
      setDeliverySlots(slots);
      setDeliverySlotsLoading(false);
    });
  }, [deliveryDate, fetchSlots]);

  function getPickupLocationText() {
    let text = pickupTerminal;
    if (pickupAirline) text += ` - ${pickupAirline}`;
    return text;
  }

  function getDropOffLocationText() {
    return deliveryTerminal || "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptedTerms) {
      setShowTermsPopup(true);
      return;
    }
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const pickupDateTime = `${pickupDate}T${pickupSlot}:00`;
    const deliveryDateTime = deliveryDate && deliverySlot ? `${deliveryDate}T${deliverySlot}:00` : "";

    const luggageItems = JSON.parse(buildLuggageDetails(luggageQty));
    const selectedSvcList = servicesList.filter((s) => selectedServices[s.id]).map((s) => s.name);
    const luggageDetailsPayload = selectedSvcList.length > 0
      ? JSON.stringify([...luggageItems, { services: selectedSvcList }])
      : buildLuggageDetails(luggageQty);

    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      countryOfOrigin: selectedCountry || undefined,
      cityOfOrigin: selectedCity || undefined,
      pickupLocation: getPickupLocationText(),
      dropOffLocation: getDropOffLocationText(),
      numberOfBags: String(totalBags),
      luggageDetails: luggageDetailsPayload,
      preferredDate: pickupDateTime,
      deliveryDate: deliveryDateTime || undefined,
      promoCode: promoApplied || undefined,
      totalPrice: grandTotal,
      downPayment,
    };

    let res: Response;
    try {
      res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      try {
        const err = await res.json();
        setError(err.error || "Something went wrong");
      } catch {
        setError("Something went wrong");
      }
      setLoading(false);
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
        if (payment.url) {
          window.location.assign(payment.url);
          return;
        }
      }
    }
    router.push(`/book/confirm/${result.referenceNumber}`);
  }

  function handleNextStep() {
    const errors: string[] = [];
    if (step === 1) {
      const nameEl = document.getElementById("name") as HTMLInputElement | null;
      const emailEl = document.getElementById("email") as HTMLInputElement | null;
      const phoneEl = document.getElementById("phone") as HTMLInputElement | null;
      if (!nameEl?.value.trim()) errors.push("Please enter your Full Name");
      if (!emailEl?.value.trim()) errors.push("Please enter your Email Address");
      if (!phoneEl?.value.trim()) errors.push("Please enter your Phone Number");
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
    if (errors.length > 0) {
      setError(errors.join(". "));
      return;
    }
    setError("");
    nextStep();
  }

  if (maintenance?.enabled) {
    return (
      <div className="min-h-screen bg-blue-50/50">
        <PublicHeader showBackToHome />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 shadow-lg shadow-amber-200">
            <Wrench className="h-10 w-10 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Under Maintenance</h1>
          <p className="mt-3 text-gray-600">{maintenance.message || "We are currently undergoing scheduled maintenance. Please check back shortly."}</p>
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
          <p className="mt-2 text-gray-600">Schedule your luggage pickup. No registration needed.</p>
        </div>

        <div className="mb-8">
          <div className="relative">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <motion.div className="h-2 rounded-full bg-orange-500" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} />
            </div>
            <div className="mt-2 flex justify-between">
              {steps.map((s) => {
                const Icon = s.icon;
                const isActive = step >= s.num;
                const isCurrent = step === s.num;
                return (
                  <div key={s.num} className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${isActive ? "bg-orange-500 text-white shadow-md" : "bg-gray-200 text-gray-400"} ${isCurrent ? "ring-4 ring-blue-200" : ""}`}>
                      {isActive && step > s.num ? <Check className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : s.num}
                    </div>
                    <span className={`mt-1.5 text-[11px] font-medium ${isCurrent ? "text-blue-700" : isActive ? "text-blue-500" : "text-gray-400"}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <div className="mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Contact Information</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                        <Input id="name" name="name" placeholder="Juan Dela Cruz" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                        <Input id="email" name="email" type="email" placeholder="juan@email.com" required />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                        <Input id="phone" name="phone" type="tel" placeholder="+63 912 345 6789" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="countryOfOrigin">Country of Origin <span className="text-red-500">*</span></Label>
                        <Input
                          id="countryOfOrigin"
                          list="country-options"
                          value={selectedCountry}
                          onChange={(e) => {
                            setSelectedCountry(e.target.value);
                            setCities([]);
                            setSelectedCity("");
                            setCitiesLoading(!!e.target.value);
                          }}
                          required
                          placeholder={countriesLoading ? "Loading countries..." : "Type or select a country"}
                        />
                        <datalist id="country-options">{countries.map((c) => <option key={c.code} value={c.name} />)}</datalist>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cityOfOrigin">City of Origin <span className="text-red-500">*</span></Label>
                        <Input
                          id="cityOfOrigin"
                          list="city-options"
                          value={selectedCity}
                          onChange={(e) => setSelectedCity(e.target.value)}
                          disabled={!selectedCountry}
                          required
                          placeholder={!selectedCountry ? "Enter a country first" : citiesLoading ? "Loading cities..." : "Type or select a city"}
                        />
                        <datalist id="city-options">{cities.map((city) => <option key={city} value={city} />)}</datalist>
                      </div>
                    </div>
                    {error && (
                      <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="mt-8 flex justify-end">
                      <Button type="button" onClick={handleNextStep} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600">
                        Next Step <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
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
                          const coords = NAIA_TERMINAL_COORDS[e.target.value];
                          if (coords) {
                            setPickupLat(coords.lat);
                            setPickupLng(coords.lng);
                          }
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

                    {pickupLat && pickupLng && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        <span>Current location detected for rider reference</span>
                      </div>
                    )}

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pickupDate">Pickup Date <span className="text-red-500">*</span></Label>
                        <Input id="pickupDate" type="date" min={today()} value={pickupDate} onChange={(e) => { setPickupDate(e.target.value); setPickupSlots([]); setPickupSlot(""); setPickupSlotsLoading(!!e.target.value); }} required />
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
                                      ? "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                                      : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-300"
                                }`}
                              >
                                <span className="block">{slot.start}</span>
                                <span className="block text-[10px] opacity-70">{slot.end}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {pickupSlot && <p className="mt-2 text-xs text-green-600">Selected: {pickupSlot}</p>}
                      </div>
                    )}

                    <div className="my-6 border-t border-gray-200" />

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-indigo-500" />
                        Drop-off Terminal <span className="text-red-500">*</span>
                      </Label>
                      <select
                        value={deliveryTerminal}
                        onChange={(e) => setDeliveryTerminal(e.target.value)}                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                      <Input type="date" min={pickupDate || today()} value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); setDeliverySlots([]); setDeliverySlot(""); setDeliverySlotsLoading(!!e.target.value); }} className="mt-2" required />
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
                                      ? "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
                                      : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-300"
                                }`}
                              >
                                <span className="block">{slot.start}</span>
                                <span className="block text-[10px] opacity-70">{slot.end}</span>
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

                    <div className="mt-8 flex items-center justify-between">
                      <Button type="button" variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                      <Button type="button" onClick={handleNextStep} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600 disabled:opacity-50">
                        Next Step <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <div className="mb-4 flex items-center gap-2">
                      <Luggage className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Luggage Details</h3>
                    </div>

                    {storageDays > 0 && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        <Package className="h-4 w-4 shrink-0" />
                        <span>
                          Storage Duration: <strong>{storageDays} day{storageDays > 1 ? "s" : ""}</strong> (from pickup to delivery)
                        </span>
                      </div>
                    )}

                    {/* Luggage Types - Separate Container */}
                    <Card className="mt-8 border-t-4 border-blue-400 shadow-md">
                      <CardContent className="pt-5">
                        <Label className="mb-2 flex items-center gap-1.5 text-base">
                          <Package className="h-4 w-4 text-blue-500" />
                          Luggage Types — Select your bags
                        </Label>
                        <p className="mb-4 text-xs text-muted-foreground">Choose the type and quantity of each luggage you want to store.</p>

                        {/* Important Notice */}
                        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <div className="space-y-1">
                            <p className="font-semibold">Important Notice</p>
                            <p className="text-xs leading-relaxed text-amber-700">
                              Do not include prohibited items such as hazardous materials, perishables, firearms, or valuables (cash, jewelry, electronics).
                              Dropnfly is not liable for prohibited or valuable items packed inside your luggage.
                              Each bag must fit within the selected size category.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          {LUGGAGE_TYPES.map((lt) => {
                            const qty = luggageQty[lt.id] || 0;
                            return (
                              <div key={lt.id} className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all ${qty > 0 ? `${lt.color} shadow-md` : "border-gray-200 bg-white hover:border-gray-300"}`}>
                                <div className="mb-3 flex justify-center">
                                  <SuitcaseIllustration type={lt} qty={qty} />
                                </div>
                                <div className="text-center">
                                  <p className="text-sm font-bold">{lt.name}</p>
                                  <p className="mt-0.5 text-[10px] text-gray-500">{lt.description}</p>
                                  <p className="mt-1 text-[11px] leading-tight text-gray-400">{lt.dimensions}</p>
                                  <p className="mt-1 text-sm font-extrabold text-gray-800">&#x20B1;{lt.price}</p>
                                </div>
                                <div className="mt-3 flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setLuggageQty((prev) => ({ ...prev, [lt.id]: Math.max(0, (prev[lt.id] || 0) - 1) }))}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => setLuggageQty((prev) => ({ ...prev, [lt.id]: (prev[lt.id] || 0) + 1 }))}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {totalBags > 0 && (
                          <div className="mt-5 space-y-2.5 rounded-lg border bg-gray-50/80 p-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Total luggage:</span>
                              <span className="font-bold">{totalBags} bag{totalBags > 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="font-bold">&#x20B1;{subtotal.toFixed(2)}</span>
                            </div>
                            {totalBags > fees.excessBagThreshold && (
                              <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm">
                                <span className="flex items-center gap-1.5 text-amber-700">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Excess fee: {totalBags - fees.excessBagThreshold} × &#x20B1;{fees.excessBagFee.toFixed(2)}/bag (over {fees.excessBagThreshold} bags)
                                </span>
                                <span className="font-bold text-amber-700">+&#x20B1;{extraFee.toFixed(2)}</span>
                              </div>
                            )}
                            {totalBags > fees.excessBagThreshold && (
                              <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm font-bold">
                                <span>Estimated total:</span>
                                <span className="text-lg">&#x20B1;{(subtotal + extraFee).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Additional Services */}
                    <Card className="mt-6 border-t-4 border-violet-400 shadow-md">
                      <CardContent className="pt-5">
                        <Label className="mb-2 flex items-center gap-1.5 text-base">
                          <Package className="h-4 w-4 text-violet-500" />
                          Additional Services
                        </Label>
                        <p className="mb-4 text-xs text-muted-foreground">Default process: customer drops off and picks up luggage at the terminal. Add services below for convenience.</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {servicesList.map((svc) => (
                            <label
                              key={svc.id}
                              className={`flex items-center justify-between rounded-xl border-2 p-4 transition-all cursor-pointer ${
                                selectedServices[svc.id]
                                  ? "border-violet-400 bg-violet-50 shadow-md"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={!!selectedServices[svc.id]}
                                  onCheckedChange={(checked) =>
                                    setSelectedServices((prev) => ({ ...prev, [svc.id]: !!checked }))
                                  }
                                />
                                <div>
                                  <p className="text-sm font-semibold">{svc.name}</p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">{svc.description}</p>
                                </div>
                              </div>
                              <span className="ml-3 shrink-0 text-sm font-bold text-violet-700">+&#x20B1;{svc.price}</span>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="mt-8 flex items-center justify-between">
                      <Button type="button" variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                      <Button type="button" onClick={handleNextStep} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600">
                        Next Step <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <div className="mb-4 flex items-center gap-2">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-lg font-semibold">Payment</h3>
                    </div>

                    <div className="rounded-lg border bg-gray-50/50 p-4 text-sm">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Transaction Summary</p>

                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-600">
                          <span>Pickup</span>
                          <span className="font-medium text-right max-w-[200px]">{getPickupLocationText()}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Schedule</span>
                          <span className="font-medium">{pickupDate} at {pickupSlot}</span>
                        </div>
                        {deliveryTerminal && (
                          <div className="flex justify-between text-gray-600">
                            <span>Drop-off</span>
                            <span className="font-medium text-right max-w-[200px]">{getDropOffLocationText()}</span>
                          </div>
                        )}
                        {deliveryDate && deliverySlot && (
                          <div className="flex justify-between text-gray-600">
                            <span>Delivery</span>
                            <span className="font-medium">{deliveryDate} at {deliverySlot}</span>
                          </div>
                        )}
                        {storageDays > 0 && (
                          <div className="flex justify-between text-blue-700 font-medium">
                            <span>Storage Duration</span>
                            <span>{storageDays} day{storageDays > 1 ? "s" : ""}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Luggage</p>
                        <div className="space-y-1.5">
                          {LUGGAGE_TYPES.filter((lt) => (luggageQty[lt.id] || 0) > 0).map((lt) => (
                            <div key={lt.id} className="flex justify-between text-gray-600">
                              <span>{lt.name} <span className="text-gray-400">x{luggageQty[lt.id]}</span></span>
                              <span>&#x20B1;{(lt.price * (luggageQty[lt.id] || 0)).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {servicesList.filter((s) => selectedServices[s.id]).length > 0 && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Additional Services</p>
                          <div className="space-y-1.5">
                            {servicesList.filter((s) => selectedServices[s.id]).map((svc) => (
                              <div key={svc.id} className="flex justify-between text-gray-600">
                                <span>{svc.name}</span>
                                <span className="font-medium">+&#x20B1;{svc.price.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 border-t border-gray-200 pt-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">&#x20B1;{subtotal.toFixed(2)}</span>
                        </div>
                        {extraFee > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>Excess fee ({totalBags - fees.excessBagThreshold} × &#x20B1;{fees.excessBagFee.toFixed(2)})</span>
                            <span>+&#x20B1;{extraFee.toFixed(2)}</span>
                          </div>
                        )}
                        {servicesCost > 0 && (
                          <div className="flex justify-between text-violet-600">
                            <span>Additional services</span>
                            <span>+&#x20B1;{servicesCost.toFixed(2)}</span>
                          </div>
                        )}
                        {promoApplied && (
                          <div className="flex justify-between text-green-600">
                            <span>Promo discount ({promoApplied})</span>
                            <span>-&#x20B1;{promoDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-300 pt-2 text-base font-bold">
                          <span>Grand Total</span>
                          <span className="text-lg">&#x20B1;{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m0 0v1.125c0 .621-.504 1.125-1.125 1.125H1.875c-.621 0-1.125-.504-1.125-1.125V6M3.75 6h17.25M3 12h18" />
                        </svg>
                        <h3 className="text-base font-semibold">Payment Option</h3>
                      </div>
                      <p className="mb-3 text-xs text-blue-700">{paymentDemoMode ? "Online payment is temporarily suspended. No payment is required while testing the complete booking workflow." : <>Slide to choose how much to pay now. Minimum of <strong>{dpMin}%</strong> is required to reserve your slot.</>}</p>
                      <div className="mb-3 flex items-center gap-4">
                        <div
                          className="relative w-full"
                          onPointerMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                            setPaymentHover(Math.round((dpMin + ratio * (100 - dpMin)) / 5) * 5);
                          }}
                          onPointerLeave={() => setPaymentHover(null)}
                        >
                          <input
                            type="range"
                            min={dpMin}
                            max={100}
                            step={5}
                            value={paymentPercent}
                            onChange={(e) => setPaymentPercent(Number(e.target.value))}
                            className="w-full accent-blue-600"
                            aria-label="Down payment percentage"
                            disabled={paymentDemoMode}
                          />
                          {paymentHover !== null && (
                            <div
                              className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md bg-blue-700 px-2 py-1 text-[11px] font-bold text-white shadow-lg whitespace-nowrap"
                              style={{ left: `${((paymentHover - dpMin) / (100 - dpMin)) * 100}%` }}
                            >
                              ₱{Math.ceil(grandTotal * (paymentHover / 100)).toLocaleString()} ({paymentHover}%)
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 rounded-lg border border-blue-200 bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700 tabular-nums">
                          {paymentDemoMode ? "Demo" : `${paymentPercent}%`}
                        </span>
                      </div>
                      <div className="mb-1 flex justify-between text-[10px] font-medium text-blue-500">
                        <span>{dpMin}% (minimum)</span>
                        <span>100%</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-blue-800">
                          <span>{paymentDemoMode ? "Due now (demo mode)" : "Pay now"}</span>
                          <span className="font-bold">&#x20B1;{downPayment.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-blue-600">
                          <span>{paymentDemoMode ? "Balance for staff recording" : "Collect later (remaining)"}</span>
                          <span className="font-medium">&#x20B1;{remainingBalance.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="mb-4 flex items-center gap-2">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                        </svg>
                        <h3 className="text-lg font-semibold">Promo Code</h3>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Enter promo code" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm" />
                        <Button type="button" variant="outline" onClick={async () => {
                          setPromoError(""); setPromoDiscount(0); setPromoApplied("");
                          if (!promoCode) return;
                          try {
                            const res = await fetch("/api/promo-codes/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode }) });
                            const data = await res.json();
                            if (data.valid) { setPromoDiscount(data.discount); setPromoApplied(promoCode); setPromoCode(""); }
                            else setPromoError("Invalid promo code");
                          } catch { setPromoError("Failed to validate"); }
                        }}>Apply</Button>
                      </div>
                      {promoApplied && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 p-2 text-sm text-green-700">
                          <span>Promo &ldquo;{promoApplied}&rdquo; applied! Discount: &#x20B1;{promoDiscount.toFixed(2)}</span>
                          <button type="button" onClick={() => { setPromoApplied(""); setPromoDiscount(0); }} className="ml-auto text-green-500 hover:text-green-700">Remove</button>
                        </div>
                      )}
                      {promoError && <p className="mt-1 text-sm text-red-500">{promoError}</p>}
                    </div>

                    <div className="mt-6 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                      <Checkbox
                        id="acceptTerms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="acceptTerms" className="text-xs leading-relaxed text-gray-600 cursor-pointer">
                        I have read and agree to the{" "}
                        <button type="button" onClick={() => setShowTermsModal(true)} className="font-medium text-blue-600 underline hover:text-blue-800">
                          Terms &amp; Conditions
                        </button>{" "}
                        and{" "}
                        <button type="button" onClick={() => setShowPrivacyModal(true)} className="font-medium text-blue-600 underline hover:text-blue-800">
                          Privacy Policy
                        </button>{" "}
                        of Dropnfly.
                      </Label>
                    </div>

                    {error && (
                      <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                      <Button type="button" variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                      <Button type="submit" className="bg-orange-500 text-white shadow-lg hover:bg-orange-600 hover:shadow-xl" size="lg" disabled={loading}>
                        {loading ? (
                          <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Processing...</span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">{paymentDemoMode ? "Confirm Demo Booking" : `Pay ₱${downPayment.toFixed(2)} now`} <ChevronRight className="h-5 w-5" /></span>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

        <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
        <PrivacyModal open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      </main>

      <PublicFooter />
    </div>
  );
}

function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch("/api/public/settings")
      .then((res) => res.json())
      .then((data) => { if (mounted) setContent(data.terms_and_conditions || ""); })
      .catch(() => { if (mounted) setContent(""); });
    return () => { mounted = false; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Terms &amp; Conditions</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">&times;</button>
        </div>
        {content === null ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : content ? (
          <div className="space-y-3 text-sm whitespace-pre-wrap leading-relaxed text-gray-600">{content}</div>
        ) : (
          <p className="text-sm text-gray-500">Terms &amp; Conditions are currently unavailable. Please try again later.</p>
        )}
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600">Close</button>
      </div>
    </div>
  );
}

function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch("/api/public/settings")
      .then((res) => res.json())
      .then((data) => { if (mounted) setContent(data.privacy_policy || ""); })
      .catch(() => { if (mounted) setContent(""); });
    return () => { mounted = false; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Privacy Policy</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">&times;</button>
        </div>
        {content === null ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : content ? (
          <div className="space-y-3 text-sm whitespace-pre-wrap leading-relaxed text-gray-600">{content}</div>
        ) : (
          <p className="text-sm text-gray-500">Privacy Policy is currently unavailable. Please try again later.</p>
        )}
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600">Close</button>
      </div>
    </div>
  );
}
