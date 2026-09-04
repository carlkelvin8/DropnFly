"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Globe, MapPin, AlertCircle, ArrowRight, User } from "lucide-react";

interface ContactStepProps {
  customerName: string;
  setCustomerName: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  selectedCountry: string;
  setSelectedCountry: (v: string) => void;
  selectedCity: string;
  setSelectedCity: (v: string) => void;
  countries: { name: string; code: string }[];
  cities: string[];
  countriesLoading: boolean;
  citiesLoading: boolean;
  setCities: (v: string[]) => void;
  error: string;
  onNext: () => void;
}

export function ContactStep({
  customerName, setCustomerName,
  customerEmail, setCustomerEmail,
  customerPhone, setCustomerPhone,
  selectedCountry, setSelectedCountry,
  selectedCity, setSelectedCity,
  countries, cities,
  countriesLoading, citiesLoading,
  setCities, error, onNext,
}: ContactStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function isInvalid(field: string, value: string) {
    return touched[field] && !value.trim();
  }

  return (
    <div key="step1" style={{ animation: "step-in 0.25s ease-out" }}>
      <style>{`@keyframes step-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div className="mb-4 flex items-center gap-2">
        <User className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Contact Information</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
          <Input id="name" name="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} onBlur={() => markTouched("name")} aria-invalid={isInvalid("name", customerName) || undefined} className={isInvalid("name", customerName) ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="Juan Dela Cruz" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
          <Input id="email" name="email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} onBlur={() => markTouched("email")} aria-invalid={isInvalid("email", customerEmail) || undefined} className={isInvalid("email", customerEmail) ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="juan@email.com" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
          <Input id="phone" name="phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} onBlur={() => markTouched("phone")} aria-invalid={isInvalid("phone", customerPhone) || undefined} className={isInvalid("phone", customerPhone) ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="+63 912 345 6789" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="countryOfOrigin">Country of Origin <span className="text-red-500">*</span></Label>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SearchableCombobox
              id="countryOfOrigin"
              value={selectedCountry}
              onChange={(v) => { setSelectedCountry(v); setCities([]); setSelectedCity(""); }}
              options={countries.map((c) => c.name)}
              loading={countriesLoading}
              placeholder={countriesLoading ? "Loading countries..." : "Type to search a country"}
              className="flex-1"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">All countries are accepted. You may type a country even if it is not shown in the suggestions.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cityOfOrigin">City of Origin <span className="text-red-500">*</span></Label>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SearchableCombobox
              id="cityOfOrigin"
              value={selectedCity}
              onChange={setSelectedCity}
              options={cities}
              loading={citiesLoading}
              disabled={!selectedCountry}
              placeholder={!selectedCountry ? "Enter a country first" : citiesLoading ? "Loading cities..." : "Type to search a city"}
              className="flex-1"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">All cities are accepted. Suggestions are optional; type the complete city name if it is not listed.</p>
          {isInvalid("city", selectedCity) && (
            <p className="text-[11px] text-red-500">Please select your City of Origin</p>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="mt-8 flex justify-end">
        <Button type="button" onClick={onNext} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600">
          Next Step <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
