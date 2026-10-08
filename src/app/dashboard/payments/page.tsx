"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  booking: { referenceNumber: string };
  customer: { name: string };
}

export default function PaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const allowed = role === "ADMIN" || role === "STAFF";
  const [query, setQuery] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchSeq = useRef(0);

  if (status !== "loading" && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">Only staff and administrators can view payments.</p>
        <Button className="mt-4" onClick={() => router.replace("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  async function handleSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const name = query.trim();
    if (name.length < 2) {
      toast.error("Enter at least 2 characters of the customer name");
      return;
    }

    const seq = ++searchSeq.current;
    setLoading(true);
    setSearched(true);
    setPayments([]);
    try {
      const response = await fetch(`/api/payments?q=${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      if (seq !== searchSeq.current) return;
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      if (seq !== searchSeq.current) return;
      toast.error("Unable to search transactions");
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  }

  const totalRevenue = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-gray-500">Search by customer name to view their existing transactions.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => {
                searchSeq.current++;
                setQuery(event.target.value);
                setPayments([]);
                setSearched(false);
                setLoading(false);
              }}
              placeholder="Search customer name"
              aria-label="Search customer name"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {searched && !loading && (
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱{totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{payments.filter((p) => p.status === "PENDING").length}</p>
          </CardContent>
        </Card>
      </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : !searched ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="mx-auto h-12 w-12 mb-3 text-gray-300" />
              <p>Search a customer name to view matching transactions.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="mx-auto h-12 w-12 mb-3 text-gray-300" />
              <p>No transactions found matching &quot;{query.trim()}&quot;.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.booking.referenceNumber}</td>
                      <td className="px-4 py-3">{p.customer.name}</td>
                      <td className="px-4 py-3">₱{p.amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === "PAID" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
