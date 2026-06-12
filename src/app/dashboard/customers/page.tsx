"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, Trash2, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  _count: { bookings: number };
  createdAt: string;
}

const ITEMS_PER_PAGE = 10;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      toast.success("Customer deleted successfully");
    } catch {
      toast.error("Failed to delete customer");
    }
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button asChild>
          <Link href="/dashboard/customers/new">
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Total Bookings</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((customer) => (
                  <TableRow key={customer.id} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer._count.bookings}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/customers/${customer.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteConfirm({ id: customer.id, name: customer.name })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow className="border-b transition-colors hover:bg-muted/50">
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mb-4" />
                        <p className="text-lg font-medium">{customers.length === 0 ? "No customers yet" : "No customers match your search"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        title="Delete Customer"
        message={`Are you sure you want to delete customer ${deleteConfirm?.name ?? ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
