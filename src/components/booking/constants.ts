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
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
  "Åland Islands", "American Samoa", "Anguilla", "Antarctica", "Aruba", "Bermuda", "Bonaire, Sint Eustatius and Saba", "Bouvet Island", "British Indian Ocean Territory", "British Virgin Islands", "Cayman Islands", "Christmas Island", "Cocos (Keeling) Islands", "Cook Islands", "Curaçao", "Falkland Islands", "Faroe Islands", "French Guiana", "French Polynesia", "French Southern Territories", "Gibraltar", "Greenland", "Guadeloupe", "Guam", "Guernsey", "Heard Island and McDonald Islands", "Isle of Man", "Jersey", "Macao", "Martinique", "Mayotte", "Montserrat", "New Caledonia", "Niue", "Norfolk Island", "Northern Mariana Islands", "Pitcairn Islands", "Puerto Rico", "Réunion", "Saint Barthélemy", "Saint Helena, Ascension and Tristan da Cunha", "Saint Martin", "Saint Pierre and Miquelon", "Sint Maarten", "South Georgia and the South Sandwich Islands", "Svalbard and Jan Mayen", "Tokelau", "Turks and Caicos Islands", "United States Minor Outlying Islands", "United States Virgin Islands", "Wallis and Futuna",
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
  "New Zealand": ["Auckland", "Wellington", "Christchurch", "Queenstown"],
  "Italy": ["Rome", "Milan", "Florence", "Venice", "Naples"],
  "Spain": ["Madrid", "Barcelona", "Valencia", "Seville"],
  "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
  "Switzerland": ["Zurich", "Geneva", "Basel", "Bern"],
  "Kuwait": ["Kuwait City"],
  "Bahrain": ["Manama"],
  "Oman": ["Muscat"],
  "India": ["Mumbai", "New Delhi", "Bangalore", "Chennai", "Kolkata"],
  "Bangladesh": ["Dhaka", "Chittagong"],
  "Pakistan": ["Karachi", "Lahore", "Islamabad"],
  "Sri Lanka": ["Colombo", "Kandy"],
  "Nepal": ["Kathmandu", "Pokhara"],
};

export const BOOKING_STEPS = [
  { num: 1, label: "Contact", iconName: "User" },
  { num: 2, label: "Pickup", iconName: "MapPin" },
  { num: 3, label: "Delivery & Luggage", iconName: "Luggage" },
  { num: 4, label: "Payment", iconName: "Check" },
];

export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
