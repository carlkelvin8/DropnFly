import { AIRLINES } from "@/components/booking/constants";

// Per-terminal airline availability. Real NAIA mapping is approximate but ensures
// each terminal shows only relevant carriers. Admin can still see all via "All" fallback.
export const TERMINAL_AIRLINES: Record<string, string[]> = {
  "NAIA Terminal 1": [
    "Philippine Airlines", "PAL Express",
    "Emirates", "Qatar Airways", "Etihad Airways", "Turkish Airlines", "Thai Airways",
    "EVA Air", "China Airlines", "Singapore Airlines", "Cathay Pacific",
    "Japan Airlines", "Korean Air",
    "Delta Air Lines", "United Airlines",
    "AirSWIFT",
  ],
  "NAIA Terminal 2": [
    "Philippine Airlines", "PAL Express",
    "AirAsia Philippines", "Cebu Pacific",
  ],
  "NAIA Terminal 3": [
    "Cebu Pacific", "AirAsia Philippines", "AirSWIFT",
    "Philippine Airlines", "PAL Express",
    "Singapore Airlines", "Cathay Pacific", "Emirates", "Qatar Airways",
    "Korean Air", "Japan Airlines", "EVA Air", "China Airlines",
    "Thai Airways", "Etihad Airways", "Turkish Airlines",
    "Delta Air Lines", "United Airlines",
  ],
  "NAIA Terminal 4": [
    "Cebu Pacific", "AirAsia Philippines", "AirSWIFT",
    "PAL Express",
  ],
};

export function getAirlinesForTerminal(terminal: string): string[] {
  if (!terminal) return AIRLINES;
  return TERMINAL_AIRLINES[terminal] || AIRLINES;
}
