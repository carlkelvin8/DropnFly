"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Trash2 } from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  usedCount: number;
  maxUsage: number;
  minAmount: number;
  maxDiscount: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPromos(); }, []);

  async function loadPromos() {
    try {
      const res = await fetch("/api/promo-codes");
      if (res.ok) setPromos(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.get("code"),
          description: formData.get("description"),
          type: formData.get("type"),
          value: formData.get("value"),
          maxUsage: formData.get("maxUsage"),
          minAmount: formData.get("minAmount"),
          maxDiscount: formData.get("maxDiscount") || null,
          expiresAt: formData.get("expiresAt") || null,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        loadPromos();
      }
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this promo code?")) return;
    const res = await fetch(`/api/promo-codes/${id}`, { method: "DELETE" });
    if (res.ok) loadPromos();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promo Codes</h1>
          <p className="text-gray-500">Manage discounts and promotions</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          New Promo Code
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Promo Code</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" placeholder="SAVE20" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select id="type" name="type" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm" required>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed (₱)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input id="value" name="value" type="number" min="1" placeholder="20" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUsage">Max Usage</Label>
                <Input id="maxUsage" name="maxUsage" type="number" min="1" defaultValue="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minAmount">Min. Order Amount (₱)</Label>
                <Input id="minAmount" name="minAmount" type="number" min="0" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDiscount">Max Discount (₱, optional)</Label>
                <Input id="maxDiscount" name="maxDiscount" type="number" min="0" placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires At (optional)</Label>
                <Input id="expiresAt" name="expiresAt" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input id="description" name="description" placeholder="Summer sale discount" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : promos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Tag className="mx-auto h-12 w-12 mb-3 text-gray-300" />
              <p>No promo codes yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {promos.map((promo) => (
                <div key={promo.id} className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{promo.code}</span>
                      <Badge>{promo.type === "PERCENTAGE" ? `${promo.value}%` : `₱${promo.value}`}</Badge>
                      {!promo.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {promo.description && (
                      <p className="text-sm text-gray-500">{promo.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Used {promo.usedCount}/{promo.maxUsage} &bull;
                      Min: ₱{promo.minAmount}
                      {promo.maxDiscount && ` &bull; Max: ₱${promo.maxDiscount}`}
                      {promo.expiresAt && ` &bull; Expires: ${new Date(promo.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(promo.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
