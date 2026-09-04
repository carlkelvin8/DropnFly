"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";
import { LUGGAGE_TYPES, calcSubtotal, calcTotalBags } from "@/lib/luggage-types";

interface PaymentStepProps {
  pickupDate: string;
  pickupSlot: string;
  pickupTerminal: string;
  pickupAirline: string;
  deliveryTerminal: string;
  deliveryAirline: string;
  deliveryDate: string;
  deliverySlot: string;
  luggageQty: Record<string, number>;
  selectedServices: Record<string, boolean>;
  fees: { pickupFee: number; deliveryFee: number; excessBagFee: number; excessBagThreshold: number };
  luggagePrices: Record<string, number>;
  discountCodesEnabled: boolean;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoApplied: string;
  setPromoApplied: (v: string) => void;
  promoDiscount: number;
  setPromoDiscount: (v: number) => void;
  promoError: string;
  setPromoError: (v: string) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean) => void;
  error: string;
  loading: boolean;
  storageDays: number;
  onPrev: () => void;
  onShowTermsModal: () => void;
  onShowPrivacyModal: () => void;
}

export function PaymentStep({
  pickupDate, pickupSlot, pickupTerminal, pickupAirline,
  deliveryTerminal, deliveryAirline, deliveryDate, deliverySlot,
  luggageQty, selectedServices, fees, luggagePrices, discountCodesEnabled,
  promoCode, setPromoCode, promoApplied, setPromoApplied,
  promoDiscount, setPromoDiscount, promoError, setPromoError,
  acceptedTerms, setAcceptedTerms,
  error, loading, storageDays,
  onPrev, onShowTermsModal, onShowPrivacyModal,
}: PaymentStepProps) {
  const totalBags = calcTotalBags(luggageQty);
  const billableDays = Math.max(1, storageDays);
  const subtotal = calcSubtotal(luggageQty, luggagePrices) * billableDays;
  const extraFee = totalBags > fees.excessBagThreshold ? (totalBags - fees.excessBagThreshold) * fees.excessBagFee : 0;
  const servicesList = [
    { id: "pick-up-from-customer", name: "Pick-up from Customer", price: fees.pickupFee },
    { id: "deliver-to-customer", name: "Deliver to Customer", price: fees.deliveryFee },
  ];
  const servicesCost = servicesList.filter((s) => selectedServices[s.id]).reduce((sum, s) => sum + s.price, 0);
  const estimatedTotal = Math.max(0, subtotal + extraFee + servicesCost - promoDiscount);
  const amountPaid = 0;
  const remainingBalance = estimatedTotal;

  function getPickupLocationText() {
    let text = pickupTerminal;
    if (pickupAirline) text += ` - ${pickupAirline}`;
    return text;
  }

  function getDropOffLocationText() {
    let text = deliveryTerminal || "";
    if (deliveryAirline) text += ` - ${deliveryAirline}`;
    return text;
  }

  return (
    <div key="step4" style={{ animation: "step-in 0.25s ease-out" }}>
      <style>{`@keyframes step-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Booking Summary</h3>
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
                <span>&#x20B1;{((luggagePrices[lt.id] ?? lt.price) * (luggageQty[lt.id] || 0) * billableDays).toFixed(2)}</span>
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
            <span className="text-muted-foreground">Storage subtotal ({billableDays} day{billableDays > 1 ? "s" : ""})</span>
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
            <span>Estimated Total</span>
            <span className="text-lg">&#x20B1;{estimatedTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm">
        <div className="space-y-1.5">
          <div className="flex justify-between text-blue-800">
            <span>Amount Paid</span>
            <span className="font-bold">&#x20B1;0.00</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3">
            <span className="font-semibold text-amber-900">Remaining Balance to Pay</span>
            <span className="font-bold text-amber-800">&#x20B1;{remainingBalance.toFixed(2)}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-700">
          No payment is required during online booking. Your booking will be reserved and the balance can be settled on pickup or as arranged with DropnFly staff. This is a reservation only — it is not marked as paid.
        </p>
      </div>

      {discountCodesEnabled && <div className="mt-6">
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
              const res = await fetch("/api/promo-codes/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode, amount: estimatedTotal }) });
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
      </div>}

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
            <span className="flex items-center justify-center gap-2">Book Now <ChevronRight className="h-5 w-5" /></span>
          )}
        </Button>
      </div>
    </div>
  );
}
