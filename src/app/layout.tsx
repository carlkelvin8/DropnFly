import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Wrench } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getSystemSettings, setting } from "@/lib/settings";
import { BrandLogo } from "@/components/BrandLogo";
import "./globals.css";

export const metadata: Metadata = {
  title: "DropnFly - Luggage Storage & Delivery",
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
const allowedWhenMaintenance = ["/login", "/api", "/_next", "/dashboard", "/track", "/feedback", "/my-account/feedback"];

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
  // Read request-time state before touching the database so Next.js does not
  // execute the settings query during static prerendering at build time.
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-url")?.split("?")[0] || "";
  const trackBypass = headersList.get("x-track-bypass") === "1";

  // Senior: tracker must stay reachable even if x-pathname missing (RSC, hard reload, Vercel edge)
  // Fallback to referer/x-url and explicit bypass header
  const effectivePathname = pathname || headersList.get("x-url")?.split("?")[0] || "";
  const isTrackRequest = effectivePathname.startsWith("/track") || trackBypass || headersList.get("referer")?.includes("/track");
  const maintenanceApplies = !isTrackRequest && isPublicRoute(effectivePathname || pathname);
  // Dashboard/API/tracking transitions never render the maintenance screen, so
  // do not block those navigations on a settings lookup they cannot use.
  const { enabled, message } = maintenanceApplies
    ? await getMaintenanceMode()
    : { enabled: false, message: "" };
  const showMaintenance = maintenanceApplies && enabled;

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
            <BrandLogo height={40} priority className="mb-8" />
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
