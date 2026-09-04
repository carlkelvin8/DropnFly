import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Luggage Pickup - Dropnfly",
  description: "Schedule a luggage pickup at NAIA Terminals 1-4. No registration required. Real-time tracking, secure storage, and on-time delivery.",
  openGraph: {
    title: "Book Luggage Pickup - Dropnfly",
    description: "Schedule a luggage pickup at NAIA Terminals 1-4. No registration required.",
    type: "website",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
