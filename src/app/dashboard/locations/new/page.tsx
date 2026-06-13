"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

export default function NewLocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      capacity: formData.get("capacity") as string,
      pricePerDay: formData.get("pricePerDay") as string,
      openingTime: formData.get("openingTime") as string,
      closingTime: formData.get("closingTime") as string,
    };

    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success("Location created successfully");
      router.push("/dashboard/locations");
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create location");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/locations">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">Add Location</h1>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input id="name" name="name" placeholder="Downtown Storage" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Manila" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" placeholder="123 Main St" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (bags)</Label>
                <Input id="capacity" name="capacity" type="number" min="1" placeholder="100" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricePerDay">Price Per Day (PHP)</Label>
                <Input id="pricePerDay" name="pricePerDay" type="number" step="0.01" min="0" placeholder="150" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingTime">Opening Time</Label>
                <Input id="openingTime" name="openingTime" type="time" defaultValue="08:00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closingTime">Closing Time</Label>
                <Input id="closingTime" name="closingTime" type="time" defaultValue="20:00" />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Location"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/locations">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
