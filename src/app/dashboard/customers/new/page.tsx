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

export default function NewCustomerPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
    };

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success("Customer created successfully");
      router.push("/dashboard/customers");
      router.refresh();
    } else {
      const err = await res.json();
      setError(err.error || "Failed to create customer");
      toast.error(err.error || "Failed to create customer");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/customers">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">Add Customer</h1>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" placeholder="Juan Dela Cruz" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="juan@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+63 912 345 6789"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Customer"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/customers">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
