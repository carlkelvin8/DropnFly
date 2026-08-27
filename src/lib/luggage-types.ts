export interface LuggageType {
  id: string;
  name: string;
  description: string;
  dimensions: string;
  maxWeight: string;
  referenceImage: string;
  price: number;
  color: string;
  iconBg: string;
}

export const LUGGAGE_TYPES: LuggageType[] = [
  {
    id: "extra-small",
    name: "Extra Small",
    description: "Backpack, laptop bag, handbag",
    dimensions: "No fixed dimensions",
    maxWeight: "5 kg",
    referenceImage: "/images/booking/references/extra-small.png",
    price: 50,
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    iconBg: "bg-emerald-500",
  },
  {
    id: "small",
    name: "Small",
    description: "Duffle bag, carry-on suitcase",
    dimensions: "Max 45 × 30 cm (W×H)",
    maxWeight: "7 kg",
    referenceImage: "/images/booking/references/small.png",
    price: 150,
    color: "bg-blue-100 text-blue-700 border-blue-300",
    iconBg: "bg-blue-500",
  },
  {
    id: "standard",
    name: "Standard",
    description: "Medium suitcase, check-in bag",
    dimensions: "Max 45 × 75 cm (W×H)",
    maxWeight: "30 kg",
    referenceImage: "/images/booking/references/standard.png",
    price: 175,
    color: "bg-violet-100 text-violet-700 border-violet-300",
    iconBg: "bg-violet-500",
  },
  {
    id: "large",
    name: "Large",
    description: "Large suitcase, oversized bag",
    dimensions: "Max 45 × 180 cm (W×H)",
    maxWeight: "50 kg",
    referenceImage: "/images/booking/references/large.png",
    price: 250,
    color: "bg-amber-100 text-amber-700 border-amber-300",
    iconBg: "bg-amber-500",
  },
];

export const EXTRA_BAG_FEE = 100;
export const EXTRA_BAG_THRESHOLD = 3;

export function calcSubtotal(quantities: Record<string, number>, prices?: Record<string, number>): number {
  return LUGGAGE_TYPES.reduce((sum, lt) => sum + (quantities[lt.id] || 0) * (prices?.[lt.id] ?? lt.price), 0);
}

export function calcTotalBags(quantities: Record<string, number>): number {
  return LUGGAGE_TYPES.reduce((sum, lt) => sum + (quantities[lt.id] || 0), 0);
}

export function calcExtraFee(totalBags: number): number {
  if (totalBags <= EXTRA_BAG_THRESHOLD) return 0;
  return (totalBags - EXTRA_BAG_THRESHOLD) * EXTRA_BAG_FEE;
}

export function buildLuggageDetails(quantities: Record<string, number>, prices?: Record<string, number>): string {
  const items = LUGGAGE_TYPES.filter((lt) => (quantities[lt.id] || 0) > 0).map((lt) => ({
    type: lt.name,
    qty: quantities[lt.id],
    price: prices?.[lt.id] ?? lt.price,
  }));
  return JSON.stringify(items);
}
