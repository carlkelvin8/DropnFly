import { LUGGAGE_TYPES, EXTRA_BAG_FEE, EXTRA_BAG_THRESHOLD } from "./luggage-types";

export interface BookingPriceSettings {
  pickupFee: number;
  deliveryFee: number;
  excessBagFee: number;
  excessBagThreshold: number;
  luggagePrices: Record<string, number>;
}

export const DEFAULT_PRICE_SETTINGS: BookingPriceSettings = {
  pickupFee: 180,
  deliveryFee: 180,
  excessBagFee: EXTRA_BAG_FEE,
  excessBagThreshold: EXTRA_BAG_THRESHOLD,
  luggagePrices: Object.fromEntries(LUGGAGE_TYPES.map((type) => [type.name, type.price])),
};

export interface PricingLine {
  type: string;
  qty: number;
}

const SERVICES: Record<string, "pickupFee" | "deliveryFee"> = {
  "Pick-up from Customer": "pickupFee",
  "Deliver to Customer": "deliveryFee",
};

export function priceOfLuggageType(typeName: string, prices?: Record<string, number>): number | null {
  const configured = prices?.[typeName];
  if (typeof configured === "number" && Number.isFinite(configured) && configured >= 0) return configured;
  const match = LUGGAGE_TYPES.find(
    (lt) => lt.name.toLowerCase() === typeName.toLowerCase()
  );
  return match ? match.price : null;
}

export interface ComputedBookingPrice {
  subtotal: number;
  extraFee: number;
  servicesCost: number;
  discount: number;
  totalPrice: number;
  totalBags: number;
}

export function computeBookingPrice(params: {
  luggageLines: PricingLine[];
  services: string[];
  discount: number;
  settings: BookingPriceSettings;
  storageDays?: number;
}): ComputedBookingPrice {
  const { luggageLines, services, discount, settings } = params;
  const storageDays = Math.max(1, Math.ceil(params.storageDays || 1));

  let subtotal = 0;
  let totalBags = 0;
  for (const line of luggageLines) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    const price = priceOfLuggageType(line.type, settings.luggagePrices);
    if (qty === 0 || price === null) continue;
    subtotal += qty * price * storageDays;
    totalBags += qty;
  }

  const extraFee =
    totalBags > settings.excessBagThreshold
      ? (totalBags - settings.excessBagThreshold) * settings.excessBagFee
      : 0;

  let servicesCost = 0;
  for (const name of services) {
    const feeKey = SERVICES[name.trim()];
    if (feeKey) servicesCost += settings[feeKey];
  }

  const gross = subtotal + extraFee + servicesCost;
  const clampedDiscount = Math.min(gross, Math.max(0, discount));
  const totalPrice = gross - clampedDiscount;

  return { subtotal, extraFee, servicesCost, discount: clampedDiscount, totalPrice, totalBags };
}

export function parseLuggageDetails(raw: string): {
  luggageLines: PricingLine[];
  services: string[];
} {
  const luggageLines: PricingLine[] = [];
  const services: string[] = [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === "object" && "type" in item) {
          luggageLines.push({ type: String(item.type), qty: Number(item.qty) || 0 });
        } else if (item && typeof item === "object" && "services" in item) {
          const list = item.services;
          if (Array.isArray(list)) services.push(...list.map((s: unknown) => String(s)));
        }
      }
    }
  } catch {
    // invalid JSON — empty lines, caller will reject
  }

  return { luggageLines, services };
}

function parseFeeSetting(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const fee = parseInt(value);
  if (!Number.isFinite(fee) || fee < 0) return defaultValue;
  return fee;
}

export async function getBookingPriceSettings(): Promise<BookingPriceSettings> {
  const { getSystemSettings } = await import("./settings");
  const map = await getSystemSettings();

  return {
    pickupFee: parseFeeSetting(map.pickup_fee, DEFAULT_PRICE_SETTINGS.pickupFee),
    deliveryFee: parseFeeSetting(map.delivery_fee, DEFAULT_PRICE_SETTINGS.deliveryFee),
    excessBagFee: parseFeeSetting(map.excess_bag_fee, DEFAULT_PRICE_SETTINGS.excessBagFee),
    excessBagThreshold: parseFeeSetting(map.excess_bag_threshold, DEFAULT_PRICE_SETTINGS.excessBagThreshold),
    luggagePrices: {
      "Extra Small": parseFeeSetting(map.luggage_extra_small_price, 50),
      Small: parseFeeSetting(map.luggage_small_price, 150),
      Standard: parseFeeSetting(map.luggage_standard_price, 175),
      Large: parseFeeSetting(map.luggage_large_price, 250),
    },
  };
}
