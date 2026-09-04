"use client";

import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Info, Luggage, Minus, Package, Plus, AlertTriangle, ZoomIn } from "lucide-react";
import { LUGGAGE_TYPES, calcSubtotal, calcTotalBags } from "@/lib/luggage-types";

interface LuggageStepProps {
  luggageQty: Record<string, number>;
  setLuggageQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedServices: Record<string, boolean>;
  setSelectedServices: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fees: { pickupFee: number; deliveryFee: number; excessBagFee: number; excessBagThreshold: number };
  luggagePrices: Record<string, number>;
  maxBags: number;
  storageDays: number;
  onNext: () => void;
  onPrev: () => void;
}

export function LuggageStep({
  luggageQty, setLuggageQty,
  selectedServices, setSelectedServices,
  fees, luggagePrices, maxBags, storageDays, onNext, onPrev,
}: LuggageStepProps) {
  const totalBags = calcTotalBags(luggageQty);
  const subtotal = calcSubtotal(luggageQty, luggagePrices) * Math.max(1, storageDays);
  const extraFee = totalBags > fees.excessBagThreshold ? (totalBags - fees.excessBagThreshold) * fees.excessBagFee : 0;
  const servicesList = [
    { id: "pick-up-from-customer", name: "Pick-up from Customer", description: "Rider picks up luggage from your location", price: fees.pickupFee },
    { id: "deliver-to-customer", name: "Deliver to Customer", description: "Rider delivers luggage to your location", price: fees.deliveryFee },
  ];

  return (
    <div key="step3" style={{ animation: "step-in 0.25s ease-out" }}>
      <style>{`@keyframes step-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div className="mb-4 flex items-center gap-2">
        <Luggage className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Luggage Details</h3>
        {maxBags > 0 && (
          <span className="ml-auto rounded-full border bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
            Max {maxBags} bag{maxBags !== 1 ? "s" : ""} per booking (admin set)
          </span>
        )}
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-base">
              <Package className="h-4 w-4 text-blue-500" />
              Luggage Types — Select your bags
            </Label>
            <a
              href="/images/booking/references/pricing.png"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm transition hover:shadow"
            >
              <Image
                src="/images/booking/references/pricing.png"
                alt="DropnFly luggage pricing and limits"
                width={940}
                height={788}
                className="h-6 w-8 shrink-0 rounded object-cover"
              />
              Pricing &amp; limits
              <ZoomIn className="h-3 w-3" />
            </a>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Choose the type and quantity of each luggage you want to store. Tap any image to view the full-size reference.</p>

          <div className="mb-5 flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-1">
              <p className="font-semibold">Important Baggage Notes</p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-amber-900">
                <li><strong>Note 1:</strong> If your baggage exceeds the weight limit, it is okay as long as your baggage/luggage dimension fits within the required size.</li>
                <li><strong>Note 2:</strong> If your baggage/luggage dimension exceeds the required dimension, you are required to upgrade the baggage declaration (e.g., Small → Large).</li>
                <li><strong>Note 3:</strong> If you availed the Additional Service &quot;Pick-up&quot; and/or &quot;Drop-off/Delivery,&quot; the maximum baggage that Dropnfly will carry is 3 Baggages/Luggages.</li>
                <li><strong>Note 4:</strong> If your Baggage/Luggage exceeds the maximum &quot;Pick-up&quot; or &quot;Drop-off/Delivery&quot; baggage limit, you are required to pay an additional &#x20B1;100 per extra baggage.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {LUGGAGE_TYPES.map((lt) => {
              const qty = luggageQty[lt.id] || 0;
              const price = luggagePrices[lt.id] ?? lt.price;
              return (
                <div key={lt.id} className={`relative overflow-hidden rounded-xl border-2 p-3 transition-all ${qty > 0 ? `${lt.color} shadow-md` : "border-border bg-card hover:border-border"}`}>
                  <a
                    href={lt.referenceImage}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative mb-2 flex h-28 items-center justify-center overflow-hidden rounded-lg border bg-white"
                  >
                    <Image
                      src={lt.referenceImage}
                      alt={`${lt.name} size reference`}
                      width={940}
                      height={788}
                      className="h-full w-full object-contain transition-transform group-hover:scale-[1.05]"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100">
                      <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                    </span>
                  </a>
                  <div className="text-center">
                    <p className="text-sm font-bold">{lt.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{lt.description}</p>
                    <p className="mt-1 text-[11px] leading-tight text-muted-foreground/60">{lt.dimensions}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Max weight: {lt.maxWeight}</p>
                    <p className="mt-1 text-sm font-extrabold text-foreground">&#x20B1;{price}/day</p>
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
                      disabled={maxBags > 0 && totalBags >= maxBags}
                      onClick={() => setLuggageQty((prev) => ({ ...prev, [lt.id]: (prev[lt.id] || 0) + 1 }))}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
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
                <span className="text-muted-foreground">Storage subtotal ({Math.max(1, storageDays)} day{Math.max(1, storageDays) > 1 ? "s" : ""}):</span>
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
                    ? "border-violet-500 bg-violet-600 text-white shadow-md"
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
                    <p className={`mt-0.5 text-[11px] ${selectedServices[svc.id] ? "text-violet-100" : "text-muted-foreground"}`}>{svc.description}</p>
                  </div>
                </div>
                <span className={`ml-3 shrink-0 text-sm font-bold ${selectedServices[svc.id] ? "text-white" : "text-violet-700"}`}>+&#x20B1;{svc.price}</span>
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
    </div>
  );
}
