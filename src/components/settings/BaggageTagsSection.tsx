"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Tags, Plus, Trash2, Search, Loader2, Circle, CheckCircle } from "lucide-react";

interface BaggageTagRow {
  id: string;
  tagNumber: string;
  status: string;
  assignedAt: string | null;
  createdAt: string;
  booking: { referenceNumber: string } | null;
}

const TAG_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "border-emerald-300 bg-emerald-50 text-emerald-700",
  ASSIGNED: "border-blue-300 bg-blue-50 text-blue-700",
  RETIRED: "border-gray-300 bg-gray-100 text-gray-600",
  LOST: "border-red-300 bg-red-50 text-red-700",
};

export function BaggageTagsSection() {
  const [tags, setTags] = useState<BaggageTagRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newTagsText, setNewTagsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchTags = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/baggage-tags?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTags(data.tags || []);
      setTotal(data.total ?? 0);
      setSelected(new Set());
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const delay = setTimeout(() => fetchTags(), search ? 250 : 0);
    return () => clearTimeout(delay);
  }, [fetchTags, search]);

  async function addTags() {
    const numbers = newTagsText
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (numbers.length === 0) {
      toast.error("Enter at least one tag number");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/baggage-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add tags");
      toast.success(`${json.created} tag(s) added — ${json.skipped} skipped (already in inventory)`);
      setNewTagsText("");
      await fetchTags();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add tags");
    } finally {
      setAdding(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/baggage-tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: [...selected] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete tags");
      toast.success(`${json.deleted} tag(s) removed from inventory`);
      await fetchTags();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete tags");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(tagNumber: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagNumber)) next.delete(tagNumber);
      else next.add(tagNumber);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = tags.filter((t) => t.status !== "ASSIGNED");
    setSelected((prev) => {
      const allSelected = selectable.length > 0 && selectable.every((t) => prev.has(t.tagNumber));
      const next = new Set(prev);
      if (allSelected) {
        for (const t of selectable) next.delete(t.tagNumber);
      } else {
        for (const t of selectable) next.add(t.tagNumber);
      }
      return next;
    });
  }

  const availableCount = tags.filter((t) => t.status === "AVAILABLE").length;
  const assignedCount = tags.filter((t) => t.status === "ASSIGNED").length;
  const hasSelected = selected.size > 0;

  return (
    <div className="space-y-4">
      <Card className="border-t-2 border-t-purple-500 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tags className="h-4 w-4 text-purple-600" /> Baggage Tag Inventory
              </CardTitle>
              <CardDescription>
                Register the physical tag numbers printed at your location here. Only tags in this inventory can be
                entered on the Scanner page when collecting luggage.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <Tags className="h-3 w-3" /> {total.toLocaleString()} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add tags */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-medium">Add tag numbers (one per line, or comma-separated)</p>
            <textarea
              value={newTagsText}
              onChange={(e) => setNewTagsText(e.target.value)}
              rows={4}
              placeholder={"TAG-DROPFLY-SEED-001\nTAG-DROPFLY-SEED-002\nTAG-DROPFLY-SEED-003"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button size="sm" className="mt-2" onClick={addTags} disabled={adding}>
              {adding ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              {adding ? "Adding..." : "Add to Inventory"}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tag number..."
                className="pl-8 h-9 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border px-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
            </select>
            {hasSelected && (
              <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={deleting}>
                {deleting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                Delete ({selected.size})
              </Button>
            )}
          </div>

          {/* Summary badges */}
          {!loading && tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-emerald-300 text-emerald-700">Available: {availableCount}</Badge>
              <Badge variant="outline" className="border-blue-300 text-blue-700">Assigned: {assignedCount}</Badge>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Tags className="mb-2 h-8 w-8" />
              <p className="text-sm font-medium">
                {total === 0 ? "No baggage tags in inventory yet" : "No tags match your search"}
              </p>
              <p className="text-xs">
                {total === 0
                  ? "Add the tag numbers printed on your physical tags above so they can be used on the Scanner page."
                  : "Try a different search or status filter."}
              </p>
            </div>
          ) : (
            <>
              {tags.length > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button onClick={toggleSelectAll} className="inline-flex items-center gap-1.5 font-medium hover:text-foreground">
                    {tags.filter((t) => t.status !== "ASSIGNED").length > 0 && tags.filter((t) => t.status !== "ASSIGNED").every((t) => selected.has(t.tagNumber))
                      ? <><CheckCircle className="h-3.5 w-3.5" /> Deselect all ({availableCount})</>
                      : <><Circle className="h-3.5 w-3.5" /> Select all available ({availableCount})</>}
                  </button>
                  <span>{tags.length} shown</span>
                </div>
              )}
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(tag.tagNumber)}
                      disabled={tag.status === "ASSIGNED"}
                      onChange={() => toggleSelect(tag.tagNumber)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="flex-1 min-w-[140px] font-mono text-sm font-medium">{tag.tagNumber}</span>
                    <Badge variant="outline" className={`text-[10px] ${TAG_STATUS_STYLES[tag.status] || ""}`}>
                      {tag.status.replace(/_/g, " ")}
                    </Badge>
                    {tag.booking ? (
                      <span className="text-xs text-muted-foreground font-mono">{tag.booking.referenceNumber}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {tag.assignedAt
                        ? new Date(tag.assignedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : new Date(tag.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}