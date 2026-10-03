export const NAIA_TERMINAL_COORDS: Record<string, { lat: number; lng: number }> = {
  "NAIA Terminal 1": { lat: 14.50538, lng: 121.00514 },
  "NAIA Terminal 2": { lat: 14.51058, lng: 121.01222 },
  // Customer/rider meeting point at the Terminal 3 departure curbside. The
  // terminal-building centroid is several hundred metres west near Tesoros
  // and makes the customer marker appear far from the pin selected in U1.
  "NAIA Terminal 3": { lat: 14.5186, lng: 121.0188 },
  "NAIA Terminal 4": { lat: 14.5248, lng: 121.00105 },
};

export function coordinatesForLocation(location: unknown): { lat: number; lng: number } | null {
  if (typeof location !== "string") return null;
  const terminal = location.split(" - ")[0].trim();
  return NAIA_TERMINAL_COORDS[terminal] ?? null;
}

export function validCoordinates(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
