import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account - Dropnfly",
  description: "Manage your DropnFly account. View bookings, track deliveries, and update your profile.",
  openGraph: {
    title: "My Account - Dropnfly",
    description: "Manage your DropnFly account and bookings.",
    type: "website",
  },
};

export default function MyAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
