"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Info, Luggage, Minus, Package, Plus, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { LUGGAGE_TYPES, calcSubtotal, calcTotalBags, type LuggageType } from "@/lib/luggage-types";

interface LuggageStepProps {
  luggageQty: Record<string, number>;
  setLuggageQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedServices: Record<string, boolean>;
  setSelectedServices: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fees: { pickupFee: number; deliveryFee: number; excessBagFee: number; excessBagThreshold: number };
  storageDays: number;
  onNext: () => void;
  onPrev: () => void;
}

function LuggageIllustration({ type, qty }: { type: LuggageType; qty: number }) {
  const active = qty > 0;
  const stroke = active ? "stroke-emerald-600" : "stroke-muted-foreground/60";
  const fill = active ? "fill-emerald-100" : "fill-muted";
  const fillDark = active ? "fill-emerald-200" : "fill-muted/80";
  const fillAccent = active ? "fill-emerald-500" : "fill-muted-foreground/40";

  if (type.id === "extra-small") {
    // Backpack illustration
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className={`transition-all ${active ? "opacity-100" : "opacity-60"}`}>
        <rect x="16" y="12" width="24" height="32" rx="6" className={`${fill} ${stroke}`} strokeWidth="1.5" />
        <rect x="20" y="16" width="16" height="10" rx="3" className={`${fillDark} ${stroke}`} strokeWidth="1" />
        <rect x="22" y="30" width="12" height="8" rx="2" className={`${fillAccent}`} opacity="0.5" />
        <path d="M16 20 C12 20, 10 24, 10 28 L10 32" className={`${stroke}`} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M40 20 C44 20, 46 24, 46 28 L46 32" className={`${stroke}`} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <line x1="24" y1="8" x2="24" y2="12" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="8" x2="32" y2="12" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="26" y="20" width="4" height="3" rx="1" className={`${fillAccent}`} opacity="0.6" />
      </svg>
    );
  }

  if (type.id === "small") {
    // Duffle/carry-on bag
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className={`transition-all ${active ? "opacity-100" : "opacity-60"}`}>
        <rect x="8" y="18" width="40" height="22" rx="4" className={`${fill} ${stroke}`} strokeWidth="1.5" />
        <rect x="12" y="22" width="14" height="14" rx="2" className={`${fillDark} ${stroke}`} strokeWidth="1" />
        <circle cx="19" cy="29" r="3" className={`${fillAccent}`} opacity="0.5" />
        <path d="M20 14 C20 10, 28 10, 28 14" className={`${stroke}`} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M28 14 C28 10, 36 10, 36 14" className={`${stroke}`} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <line x1="12" y1="40" x2="12" y2="44" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="44" y1="40" x2="44" y2="44" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="46" r="2" className={`${fillAccent}`} />
        <circle cx="44" cy="46" r="2" className={`${fillAccent}`} />
      </svg>
    );
  }

  if (type.id === "standard") {
    // Medium suitcase with wheels
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className={`transition-all ${active ? "opacity-100" : "opacity-60"}`}>
        <rect x="12" y="8" width="32" height="38" rx="4" className={`${fill} ${stroke}`} strokeWidth="1.5" />
        <rect x="16" y="12" width="24" height="18" rx="2" className={`${fillDark} ${stroke}`} strokeWidth="1" />
        <line x1="16" y1="18" x2="40" y2="18" className={`${stroke}`} strokeWidth="0.8" opacity="0.4" />
        <line x1="16" y1="22" x2="40" y2="22" className={`${stroke}`} strokeWidth="0.8" opacity="0.4" />
        <rect x="22" y="34" width="12" height="4" rx="1" className={`${fillAccent}`} opacity="0.5" />
        <line x1="24" y1="4" x2="24" y2="8" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="4" x2="32" y2="8" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="22" y="2" width="12" height="4" rx="2" className={`${fillDark} ${stroke}`} strokeWidth="1" />
        <circle cx="18" cy="48" r="2.5" className={`${fillAccent}`} />
        <circle cx="38" cy="48" r="2.5" className={`${fillAccent}`} />
        <line x1="18" y1="46" x2="18" y2="44" className={`${stroke}`} strokeWidth="1" />
        <line x1="38" y1="46" x2="38" y2="44" className={`${stroke}`} strokeWidth="1" />
      </svg>
    );
  }

  // Large suitcase
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className={`transition-all ${active ? "opacity-100" : "opacity-60"}`}>
      <rect x="10" y="6" width="36" height="42" rx="4" className={`${fill} ${stroke}`} strokeWidth="1.5" />
      <rect x="14" y="10" width="28" height="22" rx="2" className={`${fillDark} ${stroke}`} strokeWidth="1" />
      <line x1="14" y1="16" x2="42" y2="16" className={`${stroke}`} strokeWidth="0.8" opacity="0.4" />
      <line x1="14" y1="20" x2="42" y2="20" className={`${stroke}`} strokeWidth="0.8" opacity="0.4" />
      <line x1="14" y1="24" x2="42" y2="24" className={`${stroke}`} strokeWidth="0.8" opacity="0.4" />
      <rect x="18" y="36" width="20" height="6" rx="2" className={`${fillAccent}`} opacity="0.5" />
      <line x1="22" y1="2" x2="22" y2="6" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="34" y1="2" x2="34" y2="6" className={`${stroke}`} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="20" y="0" width="16" height="4" rx="2" className={`${fillDark} ${stroke}`} strokeWidth="1" />
      <circle cx="16" cy="50" r="2.5" className={`${fillAccent}`} />
      <circle cx="40" cy="50" r="2.5" className={`${fillAccent}`} />
      <line x1="16" y1="48" x2="16" y2="46" className={`${stroke}`} strokeWidth="1" />
      <line x1="40" y1="48" x2="40" y2="46" className={`${stroke}`} strokeWidth="1" />
      <rect x="24" y="14" width="8" height="8" rx="1.5" className={`${fillAccent}`} opacity="0.4" />
    </svg>
  );
}

export function LuggageStep({
  luggageQty, setLuggageQty,
  selectedServices, setSelectedServices,
  fees, storageDays, onNext, onPrev,
}: LuggageStepProps) {
  const totalBags = calcTotalBags(luggageQty);
  const subtotal = calcSubtotal(luggageQty);
  const extraFee = totalBags > fees.excessBagThreshold ? (totalBags - fees.excessBagThreshold) * fees.excessBagFee : 0;
  const servicesList = [
    { id: "pick-up-from-customer", name: "Pick-up from Customer", description: "Rider picks up luggage from your location", price: fees.pickupFee },
    { id: "deliver-to-customer", name: "Deliver to Customer", description: "Rider delivers luggage to your location", price: fees.deliveryFee },
  ];

  return (
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

      <Card className="mt-8 border-t-4 border-blue-400 shadow-md">
        <CardContent className="pt-5">
          <Label className="mb-2 flex items-center gap-1.5 text-base">
            <Package className="h-4 w-4 text-blue-500" />
            Luggage Types — Select your bags
          </Label>
          <p className="mb-4 text-xs text-muted-foreground">Choose the type and quantity of each luggage you want to store.</p>

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
                <div key={lt.id} className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all ${qty > 0 ? `${lt.color} shadow-md` : "border-border bg-card hover:border-border"}`}>
                  <div className="mb-3 flex justify-center">
                    <LuggageIllustration type={lt} qty={qty} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">{lt.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{lt.description}</p>
                    <p className="mt-1 text-[11px] leading-tight text-muted-foreground/60">{lt.dimensions}</p>
                    <p className="mt-1 text-sm font-extrabold text-foreground">&#x20B1;{lt.price}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLuggageQty((prev) => ({ ...prev, [lt.id]: Math.max(0, (prev[lt.id] || 0) - 1) }))}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setLuggageQty((prev) => ({ ...prev, [lt.id]: (prev[lt.id] || 0) + 1 }))}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalBags > 0 && (
            <div className="mt-5 space-y-2.5 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total luggage:</span>
                <span className="font-bold">{totalBags} bag{totalBags > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
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
                <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                  <span>Estimated total:</span>
                  <span className="text-lg">&#x20B1;{(subtotal + extraFee).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                    : "border-border bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={!!selectedServices[svc.id]}
                    onCheckedChange={(checked) => setSelectedServices((prev) => ({ ...prev, [svc.id]: !!checked }))}
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
        <Button type="button" variant="outline" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <Button type="button" onClick={onNext} className="bg-orange-500 text-white shadow-lg hover:bg-orange-600">
          Next Step <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
