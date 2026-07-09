"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, User, Phone, Mail, Package, Loader2, Eye } from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalBookings: number;
  createdAt: string;
}

interface Booking {
  id: string;
  referenceNumber: string;
  pickupLocation: string;
  dropOffLocation: string;
  numberOfBags: number;
  totalPrice: number;
  status: string;
  totalPaid: number;
  balance: number;
  rider: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  async function handleSearch() {
    if (query.length < 2) return toast.error("Enter at least 2 characters");
    setLoading(true);
    setSearched(true);
    setSelectedCustomer(null);
    setBookings([]);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error();
      setCustomers(await res.json());
    } catch {
      toast.error("Search failed");
      setCustomers([]);
    }
    setLoading(false);
  }

  async function handleSelectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setBookingsLoading(true);
    setBookings([]);
    try {
      const res = await fetch(`/api/customers/${c.id}/bookings`);
      if (!res.ok) throw new Error();
      setBookings(await res.json());
    } catch {
      toast.error("Failed to load bookings");
    }
    setBookingsLoading(false);
  }

  const statusBadge: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    RECEIVED: "bg-purple-100 text-purple-700",
    IN_STORAGE: "bg-indigo-100 text-indigo-700",
    OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Customer Records</h1>
      <p className="text-sm text-muted-foreground">
        Search for a customer to view their transaction history. Results are hidden until you search.
      </p>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched && !selectedCustomer && (
        <div className="space-y-3">
          {customers.length === 0 && !loading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <User className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No customers found matching "{query}"</p>
              </CardContent>
            </Card>
          ) : (
            customers.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSelectCustomer(c)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{c.totalBookings} booking{c.totalBookings !== 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {selectedCustomer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>
              ← Back to results
            </Button>
            <h2 className="text-lg font-semibold">{selectedCustomer.name} — Transactions</h2>
          </div>

          {bookingsLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : bookings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No transactions found for this customer</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/bookings/${b.id}`} className="font-mono text-sm font-bold text-primary hover:underline">
                            {b.referenceNumber}
                          </Link>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge[b.status] || "bg-gray-100 text-gray-700"}`}>
                            {b.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.pickupLocation} → {b.dropOffLocation}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.numberOfBags} bag{b.numberOfBags !== 1 ? "s" : ""} · {formatCurrency(b.totalPrice)}
                          {b.balance > 0 && <span className="text-red-500 ml-2">{formatCurrency(b.balance)} due</span>}
                          {b.rider && <span className="ml-2">Rider: {b.rider}</span>}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/bookings/${b.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
