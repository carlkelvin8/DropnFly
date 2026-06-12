"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="flex flex-1 flex-col">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 p-4 lg:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
