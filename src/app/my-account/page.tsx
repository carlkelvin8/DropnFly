"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerDashboardPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Customer dashboard is disabled — redirecting to home...</p>
    </div>
  );
}
