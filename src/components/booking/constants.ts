export const NAIA_TERMINALS = [
  { value: "NAIA Terminal 1", label: "NAIA Terminal 1 (Ninoy Aquino International Airport)" },
  { value: "NAIA Terminal 2", label: "NAIA Terminal 2 (Centennial Terminal)" },
  { value: "NAIA Terminal 3", label: "NAIA Terminal 3" },
  { value: "NAIA Terminal 4", label: "NAIA Terminal 4 (Manila Domestic Airport)" },
];

export const NAIA_TERMINAL_COORDS: Record<string, { lat: number; lng: number }> = {
  "NAIA Terminal 1": { lat: 14.5106, lng: 121.0197 },
  "NAIA Terminal 2": { lat: 14.5118, lng: 121.0143 },
  "NAIA Terminal 3": { lat: 14.5186, lng: 121.0188 },
  "NAIA Terminal 4": { lat: 14.5081, lng: 121.0147 },
};

export const AIRLINES = [
  "Philippine Airlines", "PAL Express", "Cebu Pacific", "AirAsia Philippines", "AirSWIFT",
  "Emirates", "Qatar Airways", "Singapore Airlines", "Cathay Pacific", "Korean Air",
  "Japan Airlines", "Turkish Airlines", "Etihad Airways", "Thai Airways", "EVA Air",
  "China Airlines", "Delta Air Lines", "United Airlines",
];

export const FALLBACK_COUNTRIES = [
  "Philippines", "United States", "United Kingdom", "United Arab Emirates", "Qatar",
  "Singapore", "Japan", "South Korea", "China", "Taiwan", "Hong Kong", "Thailand",
  "Vietnam", "Indonesia", "Malaysia", "Australia", "New Zealand", "Canada", "France",
  "Germany", "Italy", "Spain", "Netherlands", "Switzerland", "Saudi Arabia", "Kuwait",
  "Bahrain", "Oman", "India", "Bangladesh", "Pakistan", "Sri Lanka", "Nepal",
];

export const FALLBACK_CITIES: Record<string, string[]> = {
  "Philippines": ["Manila", "Quezon City", "Makati", "Taguig", "Pasay", "Parañaque", "Cebu City", "Davao City", "Iloilo City", "Baguio City"],
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "San Francisco", "Seattle", "Las Vegas", "Miami"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "Qatar": ["Doha"],
  "Singapore": ["Singapore"],
  "Japan": ["Tokyo", "Osaka", "Nagoya", "Fukuoka"],
  "South Korea": ["Seoul", "Busan", "Incheon"],
  "China": ["Beijing", "Shanghai", "Guangzhou", "Xiamen"],
  "Taiwan": ["Taipei", "Kaohsiung"],
  "Hong Kong": ["Hong Kong"],
  "Thailand": ["Bangkok", "Phuket", "Chiang Mai"],
  "Vietnam": ["Hanoi", "Ho Chi Minh City"],
  "Indonesia": ["Jakarta", "Bali"],
  "Malaysia": ["Kuala Lumpur", "Penang"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth"],
  "Canada": ["Toronto", "Vancouver", "Montreal"],
  "France": ["Paris", "Nice"],
  "Germany": ["Berlin", "Frankfurt", "Munich"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
};

export const BOOKING_STEPS = [
  { num: 1, label: "Contact", iconName: "User" },
  { num: 2, label: "Pickup", iconName: "MapPin" },
  { num: 3, label: "Delivery & Luggage", iconName: "Luggage" },
  { num: 4, label: "Payment", iconName: "Check" },
];

export const today = () => new Date().toISOString().split("T")[0];
