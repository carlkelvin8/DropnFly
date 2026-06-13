"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Gift, Plus, Minus } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface LoyaltyData {
  points: number;
  history: {
    id: string;
    points: number;
    type: string;
    reference: string | null;
    description: string | null;
    createdAt: string;
  }[];
}

export default function LoyaltyPage() {
  const router = useRouter();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customer/loyalty")
      .then((r) => {
        if (!r.ok) { router.push("/my-account/login"); return null; }
        return r.json();
      })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const canRedeem = data.points >= 100;
  const discountValue = Math.floor(data.points / 100) * 50;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/my-account" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </Link>
          <span className="text-sm font-medium">Loyalty Points</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Card className="bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 text-white">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Trophy className="h-12 w-12 mb-3" />
            <p className="text-5xl font-bold">{data.points}</p>
            <p className="mt-1 text-lg font-medium opacity-90">Points</p>
            {canRedeem && (
              <p className="mt-2 text-sm opacity-80">You can redeem up to ₱{discountValue} discount!</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              <CardTitle>How Points Work</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• Earn <strong>1 point</strong> for every <strong>₱10</strong> spent on bookings</p>
            <p>• <strong>100 points</strong> = ₱50 discount on your next booking</p>
            <p>• Points are automatically credited when your booking is delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Points History</CardTitle>
          </CardHeader>
          <CardContent>
            {data.history.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No points activity yet</p>
            ) : (
              <div className="space-y-3">
                {data.history.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-1.5 ${tx.type === "EARNED" ? "bg-green-100" : "bg-red-100"}`}>
                        {tx.type === "EARNED" ? (
                          <Plus className="h-4 w-4 text-green-600" />
                        ) : (
                          <Minus className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <Badge variant={tx.type === "EARNED" ? "default" : "destructive"}>
                      {tx.type === "EARNED" ? "+" : ""}{tx.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
