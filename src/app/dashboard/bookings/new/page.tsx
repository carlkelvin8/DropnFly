"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  city: string;
  pricePerDay: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

export default function NewBookingPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/api/customers").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    ]).then(([loc, cust]) => {
      setLocations(loc);
      setCustomers(cust);
    }).catch(() => toast.error("Failed to load form data"));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: formData.get("customerId"),
        locationId: formData.get("locationId"),
        checkIn: formData.get("checkIn"),
        checkOut: formData.get("checkOut"),
        numberOfBags: formData.get("numberOfBags"),
        status: "PENDING",
      }),
    });

    if (res.ok) {
      toast.success("Booking created successfully");
      router.push("/dashboard/bookings");
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create booking");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/bookings">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">New Booking</h1>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Customer &amp; Location</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerId">Customer</Label>
                  <Select
                    id="customerId"
                    name="customerId"
                    required
                    placeholder="Select customer"
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.email})`,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationId">Location</Label>
                  <Select
                    id="locationId"
                    name="locationId"
                    required
                    placeholder="Select location"
                    options={locations.map((l) => ({
                      value: l.id,
                      label: `${l.name} - ${l.city}`,
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checkIn">Check In</Label>
                  <Input
                    id="checkIn"
                    name="checkIn"
                    type="datetime-local"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">Check Out</Label>
                  <Input
                    id="checkOut"
                    name="checkOut"
                    type="datetime-local"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Booking Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="numberOfBags">Number of Bags</Label>
                  <Input
                    id="numberOfBags"
                    name="numberOfBags"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t pt-6">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Booking"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/bookings">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
