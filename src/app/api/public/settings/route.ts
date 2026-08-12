import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TERMS = `1. Service Description
Dropnfly provides luggage storage and delivery services at NAIA Terminals 1-4. By using our service, you agree to these terms.

2. Booking & Payment
A minimum of 50% down payment is required to reserve a slot. The remaining balance is collectible upon pickup or delivery.

3. Prohibited Items
Customers must not include illegal items, hazardous materials, perishables, firearms, or valuables (cash, jewelry, electronics) in stored luggage. Dropnfly is not liable for prohibited or valuable items.

4. Storage Duration
Luggage is stored from the scheduled pickup time until the scheduled delivery time. Extended storage may incur additional fees.

5. Liability
Dropnfly's liability is limited to the declared value of the stored items. We recommend against storing irreplaceable or high-value items.

6. Cancellation
Cancellation policies vary. Contact customer support for assistance with cancellations and refunds.

7. Rider Assignment
Dropnfly assigns riders for pickup and delivery. Rider details (name, photo, vehicle, plate number) are shared with the customer.`;

const DEFAULT_PRIVACY = `1. Information We Collect
We collect personal information (name, email, phone, country/city of origin) and booking details (pickup/delivery locations, dates, times, luggage information) to provide our services.

2. How We Use Your Information
Your information is used to process bookings, assign riders, send confirmations, provide tracking, and improve our services.

3. Data Sharing
We share necessary information with our riders (name, pickup location) for service delivery. We do not sell your personal data to third parties.

4. Location Data
We may collect location data to facilitate rider pickup. This data is used only for service purposes and not stored longer than necessary.

5. Data Security
We implement reasonable security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.

6. Contact
For privacy-related inquiries, contact our support team.`;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return NextResponse.json({
      terms_and_conditions: map.terms_and_conditions || DEFAULT_TERMS,
      privacy_policy: map.privacy_policy || DEFAULT_PRIVACY,
      currency: map.currency || "PHP",
      maintenance: {
        enabled: map.maintenance_mode_enabled === "true",
        message: map.maintenance_message || "We are currently undergoing scheduled maintenance. Please check back shortly.",
      },
      pricing: {
        pickup_fee: parseInt(map.pickup_fee || "180"),
        delivery_fee: parseInt(map.delivery_fee || "180"),
        excess_bag_fee: parseInt(map.excess_bag_fee || "100"),
        excess_bag_threshold: parseInt(map.excess_bag_threshold || "3"),
      },
      booking_limits: {
        max_bags_per_booking: parseInt(map.max_bags_per_booking || "0"),
        max_storage_days: parseInt(map.max_storage_days || "0"),
        max_advance_booking_days: parseInt(map.max_advance_booking_days || "0"),
        min_dp_percentage: parseInt(map.min_dp_percentage || "0"),
      },
    });
  } catch {
    return NextResponse.json({
      terms_and_conditions: DEFAULT_TERMS,
      privacy_policy: DEFAULT_PRIVACY,
      currency: "PHP",
      maintenance: { enabled: false, message: "" },
      pricing: { pickup_fee: 180, delivery_fee: 180, excess_bag_fee: 100, excess_bag_threshold: 3 },
      booking_limits: { max_bags_per_booking: 0, max_storage_days: 0, max_advance_booking_days: 0, min_dp_percentage: 0 },
    });
  }
}
