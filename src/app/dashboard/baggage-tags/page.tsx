"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BaggageTagsSection } from "@/components/settings/BaggageTagsSection";

export default function BaggageTagsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "ADMIN";

  if (status !== "loading" && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Tags className="mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">Only administrators can manage baggage tags.</p>
        <Button className="mt-4" onClick={() => router.replace("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Baggage Tags</h1>
        <p className="text-sm text-muted-foreground">Manage the physical tag inventory and see which tags are linked to bookings.</p>
      </div>
      <BaggageTagsSection />
    </div>
  );
}