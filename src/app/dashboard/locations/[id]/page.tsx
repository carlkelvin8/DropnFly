"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
} from "@/components/ui/select";
import Link from "next/link";
import { ArrowLeft, MapPin, Building, Package, DollarSign, Clock, Circle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { locationSchema } from "@/lib/validations";

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
  pricePerDay: number;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
}

export default function EditLocationPage() {
  const router = useRouter();
  const params = useParams();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/locations/${params.id}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setLocation(data); })
      .catch(() => {});
    return () => abort.abort();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = {
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      capacity: Number(formData.get("capacity")),
      pricePerDay: Number(formData.get("pricePerDay")),
      openingTime: formData.get("openingTime") as string,
      closingTime: formData.get("closingTime") as string,
      isActive: formData.get("isActive") === "true",
    };

    const parsed = locationSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/locations/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (res.ok) {
      toast.success("Location updated successfully");
      router.push("/dashboard/locations");
      router.refresh();
    } else {
      toast.error("Failed to update location");
    }
    setLoading(false);
  }

  if (!location) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/locations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{location.name}</h1>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{location.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{location.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">City</p>
                <p className="text-sm font-medium">{location.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Capacity</p>
                <p className="text-sm font-medium">{location.capacity} bags</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Price Per Day</p>
                <p className="text-sm font-medium">{formatCurrency(location.pricePerDay)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Operating Hours</p>
                <p className="text-sm font-medium">{location.openingTime} - {location.closingTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Circle className={cn("h-4 w-4 shrink-0", location.isActive ? "fill-green-500 text-green-500" : "fill-gray-300 text-gray-300")} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium">{location.isActive ? "Active" : "Inactive"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Edit Location</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={location.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={location.city}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={location.address}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (bags)</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  defaultValue={location.capacity}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricePerDay">Price Per Day (PHP)</Label>
                <Input
                  id="pricePerDay"
                  name="pricePerDay"
                  type="number"
                  step="0.01"
                  defaultValue={location.pricePerDay}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingTime">Opening Time</Label>
                <Input
                  id="openingTime"
                  name="openingTime"
                  type="time"
                  defaultValue={location.openingTime}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closingTime">Closing Time</Label>
                <Input
                  id="closingTime"
                  name="closingTime"
                  type="time"
                  defaultValue={location.closingTime}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isActive">Status</Label>
                <Select
                  id="isActive"
                  name="isActive"
                  defaultValue={location.isActive ? "true" : "false"}
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
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
