"use client";

import { useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function PasswordExpiryGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const expired = session?.user?.passwordExpired === true;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    if (expired && pathname !== "/dashboard/change-password") {
      router.replace("/dashboard/change-password");
    }
  }, [status, session, expired, pathname, router]);

  if (status !== "loading" && !session) return null;

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SessionProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={3000}
      />
      <PasswordExpiryGuard>
        <div className="flex h-screen overflow-hidden">
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              onKeyDown={(e) => { if (e.key === "Escape") setSidebarOpen(false); }}
              role="button"
              tabIndex={-1}
              aria-label="Close sidebar"
            />
          )}

          <div
            className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:shrink-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-muted/10">
            <Navbar onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 p-4 lg:p-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <footer className="border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground lg:px-6">
              Dropnfly Operations Portal · Secure luggage storage and delivery management
            </footer>
          </div>
        </div>
      </PasswordExpiryGuard>
    </SessionProvider>
  );
}
