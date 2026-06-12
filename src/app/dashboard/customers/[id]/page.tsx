"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  bookings: {
    id: string;
    location: { name: string; city: string } | null;
    checkIn: string;
    checkOut: string | null;
    totalPrice: number;
    status: string;
    createdAt: string;
  }[];
}

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  CONFIRMED: "secondary",
  RECEIVED: "default",
  IN_STORAGE: "default",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

const statusDot: Record<string, string> = {
  PENDING: "bg-yellow-500",
  CONFIRMED: "bg-blue-500",
  RECEIVED: "bg-blue-500",
  IN_STORAGE: "bg-blue-500",
  OUT_FOR_DELIVERY: "bg-blue-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/customers/${params.id}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setCustomer(data); })
      .catch(() => {});
    return () => abort.abort();
  }, [params.id]);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
    };

    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update customer");
      const getRes = await fetch(`/api/customers/${params.id}`);
      if (!getRes.ok) throw new Error("Failed to reload customer");
      const updated = await getRes.json();
      setCustomer(updated);
      toast.success("Customer updated successfully");
      setEditing(false);
    } catch {
      toast.error("Failed to update customer");
    }
    setSaving(false);
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/customers">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent className="pt-6">
          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={customer.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={customer.email}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={customer.phone}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{customer.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{customer.phone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="font-medium">{customer.bookings.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.bookings.map((booking) => (
                <TableRow key={booking.id} className="border-b transition-colors hover:bg-muted/50">
                  <TableCell>
                    {booking.location ? `${booking.location.name}, ${booking.location.city}` : "—"}
                  </TableCell>
                  <TableCell>{formatDate(booking.checkIn)}</TableCell>
                  <TableCell>{booking.checkOut ? formatDate(booking.checkOut) : "—"}</TableCell>
                  <TableCell>{formatCurrency(booking.totalPrice)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${statusDot[booking.status] || "bg-gray-400"}`} />
                      <Badge variant={statusVariant[booking.status] || "outline"} className="font-medium">
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/bookings/${booking.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {customer.bookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <p className="text-lg font-medium">No bookings yet</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
