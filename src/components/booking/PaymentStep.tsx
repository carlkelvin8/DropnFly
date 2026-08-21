"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, ArrowLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { LUGGAGE_TYPES, calcSubtotal, calcTotalBags } from "@/lib/luggage-types";

interface PaymentStepProps {
  pickupDate: string;
  pickupSlot: string;
  pickupTerminal: string;
  pickupAirline: string;
  deliveryTerminal: string;
  deliveryDate: string;
  deliverySlot: string;
  luggageQty: Record<string, number>;
  selectedServices: Record<string, boolean>;
  fees: { pickupFee: number; deliveryFee: number; excessBagFee: number; excessBagThreshold: number };
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoApplied: string;
  setPromoApplied: (v: string) => void;
  promoDiscount: number;
  setPromoDiscount: (v: number) => void;
  promoError: string;
  setPromoError: (v: string) => void;
  paymentPercent: number;
  setPaymentPercent: (v: number) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean) => void;
  error: string;
  loading: boolean;
  storageDays: number;
  paymentDemoMode: boolean;
  minDpPercent: number;
  onPrev: () => void;
  onShowTermsModal: () => void;
  onShowPrivacyModal: () => void;
}

export function PaymentStep({
  pickupDate, pickupSlot, pickupTerminal, pickupAirline,
  deliveryTerminal, deliveryDate, deliverySlot,
  luggageQty, selectedServices, fees,
  promoCode, setPromoCode, promoApplied, setPromoApplied,
  promoDiscount, setPromoDiscount, promoError, setPromoError,
  paymentPercent, setPaymentPercent, acceptedTerms, setAcceptedTerms,
  error, loading, storageDays, paymentDemoMode, minDpPercent,
  onPrev, onShowTermsModal, onShowPrivacyModal,
}: PaymentStepProps) {
  const [paymentHover, setPaymentHover] = useState<number | null>(null);

  const totalBags = calcTotalBags(luggageQty);
  const subtotal = calcSubtotal(luggageQty);
  const extraFee = totalBags > fees.excessBagThreshold ? (totalBags - fees.excessBagThreshold) * fees.excessBagFee : 0;
  const servicesList = [
    { id: "pick-up-from-customer", name: "Pick-up from Customer", price: fees.pickupFee },
    { id: "deliver-to-customer", name: "Deliver to Customer", price: fees.deliveryFee },
  ];
  const servicesCost = servicesList.filter((s) => selectedServices[s.id]).reduce((sum, s) => sum + s.price, 0);
  const grandTotal = Math.max(0, subtotal + extraFee + servicesCost - promoDiscount);
  const downPayment = paymentDemoMode ? 0 : Math.ceil(grandTotal * (paymentPercent / 100));
  const remainingBalance = grandTotal - downPayment;
  const dpMin = Math.max(50, Math.min(100, minDpPercent || 50));

  function getPickupLocationText() {
    let text = pickupTerminal;
    if (pickupAirline) text += ` - ${pickupAirline}`;
    return text;
  }

  function getDropOffLocationText() {
    return deliveryTerminal || "";
  }

  return (
    <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold">Payment</h3>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Transaction Summary</p>
        <div className="space-y-2">
          <div className="flex justify-between text-muted-foreground">
            <span>Pickup</span>
            <span className="font-medium text-right max-w-[200px]">{getPickupLocationText()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Schedule</span>
            <span className="font-medium">{pickupDate} at {pickupSlot}</span>
          </div>
          {deliveryTerminal && (
            <div className="flex justify-between text-muted-foreground">
              <span>Drop-off</span>
              <span className="font-medium text-right max-w-[200px]">{getDropOffLocationText()}</span>
            </div>
          )}
          {deliveryDate && deliverySlot && (
            <div className="flex justify-between text-muted-foreground">
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

        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Luggage</p>
          <div className="space-y-1.5">
            {LUGGAGE_TYPES.filter((lt) => (luggageQty[lt.id] || 0) > 0).map((lt) => (
              <div key={lt.id} className="flex justify-between text-muted-foreground">
                <span>{lt.name} <span className="text-muted-foreground/60">x{luggageQty[lt.id]}</span></span>
                <span>&#x20B1;{(lt.price * (luggageQty[lt.id] || 0)).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {servicesList.filter((s) => selectedServices[s.id]).length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Services</p>
            <div className="space-y-1.5">
              {servicesList.filter((s) => selectedServices[s.id]).map((svc) => (
                <div key={svc.id} className="flex justify-between text-muted-foreground">
                  <span>{svc.name}</span>
                  <span className="font-medium">+&#x20B1;{svc.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
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
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
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
        <p className="mb-3 text-xs text-blue-700">{paymentDemoMode ? "Online payment is not configured. No payment is required at this time." : <>Slide to choose how much to pay now. Minimum of <strong>{dpMin}%</strong> is required to reserve your slot.</>}</p>
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
            {paymentPercent}%
          </span>
        </div>
        <div className="mb-1 flex justify-between text-[10px] font-medium text-blue-500">
          <span>{dpMin}% (minimum)</span>
          <span>100%</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-blue-800">
            <span>{paymentDemoMode ? "Due now" : "Pay now"}</span>
            <span className="font-bold">&#x20B1;{downPayment.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-blue-600">
            <span>{paymentDemoMode ? "Remaining balance" : "Collect later (remaining)"}</span>
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
              const res = await fetch("/api/promo-codes/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode, amount: grandTotal }) });
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

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <Checkbox
          id="acceptTerms"
          checked={acceptedTerms}
          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="acceptTerms" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
          I have read and agree to the{" "}
          <button type="button" onClick={onShowTermsModal} className="font-medium text-blue-600 underline hover:text-blue-800">
            Terms &amp; Conditions
          </button>{" "}
          and{" "}
          <button type="button" onClick={onShowPrivacyModal} className="font-medium text-blue-600 underline hover:text-blue-800">
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
        <Button type="button" variant="outline" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <Button type="submit" className="bg-orange-500 text-white shadow-lg hover:bg-orange-600 hover:shadow-xl" size="lg" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Processing...</span>
          ) : (
            <span className="flex items-center justify-center gap-2">{paymentDemoMode ? "Confirm Booking" : `Pay ₱${downPayment.toFixed(2)} now`} <ChevronRight className="h-5 w-5" /></span>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
