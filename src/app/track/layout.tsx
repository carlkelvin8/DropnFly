import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Luggage - Dropnfly",
  description: "Track your luggage in real-time. Know exactly where your bags are at NAIA with live GPS updates and delivery notifications.",
  openGraph: {
    title: "Track Luggage - Dropnfly",
    description: "Track your luggage in real-time at NAIA Terminals 1-4.",
    type: "website",
  },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
