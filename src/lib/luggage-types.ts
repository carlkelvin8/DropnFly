export interface LuggageType {
  id: string;
  name: string;
  description: string;
  dimensions: string;
  price: number;
  color: string;
  iconBg: string;
}

export const LUGGAGE_TYPES: LuggageType[] = [
  {
    id: "extra-small",
    name: "Extra Small",
    description: "Backpack, laptop bag, handbag",
    dimensions: "45 × 35 × 20 cm",
    price: 150,
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    iconBg: "bg-emerald-500",
  },
  {
    id: "small",
    name: "Small",
    description: "Duffle bag, carry-on suitcase",
    dimensions: "55 × 40 × 20 cm",
    price: 200,
    color: "bg-blue-100 text-blue-700 border-blue-300",
    iconBg: "bg-blue-500",
  },
  {
    id: "standard",
    name: "Standard",
    description: "Medium suitcase, check-in bag",
    dimensions: "65 × 45 × 25 cm",
    price: 250,
    color: "bg-violet-100 text-violet-700 border-violet-300",
    iconBg: "bg-violet-500",
  },
  {
    id: "large",
    name: "Large",
    description: "Large suitcase, oversized bag",
    dimensions: "75 × 50 × 30 cm",
    price: 300,
    color: "bg-amber-100 text-amber-700 border-amber-300",
    iconBg: "bg-amber-500",
  },
];

export const EXTRA_BAG_FEE = 100;
export const EXTRA_BAG_THRESHOLD = 3;

export function calcSubtotal(quantities: Record<string, number>): number {
  return LUGGAGE_TYPES.reduce((sum, lt) => sum + (quantities[lt.id] || 0) * lt.price, 0);
}

export function calcTotalBags(quantities: Record<string, number>): number {
  return LUGGAGE_TYPES.reduce((sum, lt) => sum + (quantities[lt.id] || 0), 0);
}

export function calcExtraFee(totalBags: number): number {
  return totalBags > EXTRA_BAG_THRESHOLD ? EXTRA_BAG_FEE : 0;
}

export function buildLuggageDetails(quantities: Record<string, number>): string {
  const items = LUGGAGE_TYPES.filter((lt) => (quantities[lt.id] || 0) > 0).map((lt) => ({
    type: lt.name,
    qty: quantities[lt.id],
    price: lt.price,
  }));
  return JSON.stringify(items);
}
