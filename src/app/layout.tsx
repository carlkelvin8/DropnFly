import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Wrench } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getSystemSettings, setting } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dropnfly - Luggage Storage & Delivery",
  description: "On-demand luggage pickup, storage, and delivery service in the Philippines.",
  other: {
    "dns-prefetch-control": "on",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Routes that must stay accessible while maintenance mode is active so
// administrators can still sign in and turn maintenance off.
const allowedWhenMaintenance = ["/login", "/api", "/_next", "/dashboard"];

function isPublicRoute(pathname: string): boolean {
  if (!pathname) return false;
  if (allowedWhenMaintenance.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return !pathname.startsWith("/api/");
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enabled, message } = await getMaintenanceMode();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  const showMaintenance = enabled && isPublicRoute(pathname);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://restcountries.com" />
        <link rel="preconnect" href="https://countriesnow.space" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://restcountries.com" />
        <link rel="dns-prefetch" href="https://countriesnow.space" />
      </head>
      <body>
        {showMaintenance ? (
          <main className="flex min-h-screen flex-col items-center justify-center bg-blue-50/50 px-4 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 shadow-lg shadow-amber-200">
              <Wrench className="h-10 w-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Under Maintenance</h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              {message || "We are currently undergoing scheduled maintenance. Please check back shortly."}
            </p>
            <Link
              href="/track"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-blue-700"
            >
              Track Existing Booking
            </Link>
          </main>
        ) : (
          <ThemeProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}

async function getMaintenanceMode() {
  const map = await getSystemSettings();
  return {
    enabled: setting(map, "maintenance_mode_enabled", "false") === "true",
    message: setting(
      map,
      "maintenance_message",
      "We are currently undergoing scheduled maintenance. Please check back shortly."
    ),
  };
}
