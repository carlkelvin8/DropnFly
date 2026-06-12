"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { Plus, MapPin, Pencil, Trash2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
  pricePerDay: number;
  isActive: boolean;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{id:string;name:string}|null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    fetch("/api/locations")
      .then((res) => res.json())
      .then(setLocations)
      .finally(() => setLoading(false));
  }, []);

  const filtered = locations.filter((l) => {
    const q = search.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q) || l.city.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginatedLocations = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  function handleDelete(id: string, name: string) {
    setDeleteConfirm({ id, name });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Storage Locations</h1>
        <Button asChild>
          <Link href="/dashboard/locations/new">
            <Plus className="mr-2 h-4 w-4" /> Add Location
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, address, or city..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
        />
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Address</TableHead>
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">City</TableHead>
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Capacity</TableHead>
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Price/Day</TableHead>
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <TableSkeleton />
                  </TableCell>
                </TableRow>
              ) : paginatedLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {location.name}
                    </div>
                  </TableCell>
                  <TableCell>{location.address}</TableCell>
                  <TableCell>{location.city}</TableCell>
                  <TableCell>{location.capacity}</TableCell>
                  <TableCell>{formatCurrency(location.pricePerDay)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${location.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="text-sm">{location.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/locations/${location.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(location.id, location.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && paginatedLocations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No locations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          try {
            await fetch(`/api/locations/${deleteConfirm.id}`, { method: "DELETE" });
            setLocations((prev) => prev.filter((l) => l.id !== deleteConfirm.id));
            toast.success("Location deleted successfully");
          } catch {
            toast.error("Failed to delete location");
          }
          setDeleteConfirm(null);
        }}
        title="Delete Location"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
