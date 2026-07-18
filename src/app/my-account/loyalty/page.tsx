"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Trophy, Gift, Plus, Minus, Star, Sparkles, TrendingUp,
} from "lucide-react";
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

function getTier(points: number) {
  if (points >= 1000) return { name: "Platinum", color: "from-slate-400 to-slate-600", textColor: "text-slate-300", next: null, progress: 100 };
  if (points >= 500) return { name: "Gold", color: "from-amber-400 to-yellow-600", textColor: "text-amber-300", next: 1000, progress: ((points - 500) / 500) * 100 };
  if (points >= 200) return { name: "Silver", color: "from-gray-300 to-gray-500", textColor: "text-gray-300", next: 500, progress: ((points - 200) / 300) * 100 };
  return { name: "Bronze", color: "from-orange-400 to-orange-600", textColor: "text-orange-300", next: 200, progress: (points / 200) * 100 };
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-amber-200 border-t-amber-600" />
      </div>
    );
  }

  if (!data) return null;

  const tier = getTier(data.points);
  const canRedeem = data.points >= 100;
  const discountValue = Math.floor(data.points / 100) * 50;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/my-account" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <span className="mx-auto text-sm font-semibold text-gray-900">Loyalty & Rewards</span>
          <div className="w-14" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Points Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-xl">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute -top-20 -right-20 h-60 w-60 rounded-full bg-gradient-to-br ${tier.color} opacity-20 blur-3xl`} />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />
          </div>

          <div className="relative">
            {/* Tier badge */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`rounded-full bg-gradient-to-r ${tier.color} px-3 py-1`}>
                <span className="text-xs font-bold text-white uppercase tracking-wider">{tier.name} Member</span>
              </div>
              <Star className={`h-4 w-4 ${tier.textColor}`} />
            </div>

            {/* Points */}
            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-bold text-white tracking-tight">{data.points.toLocaleString()}</span>
              <span className="text-lg text-white/50 mb-1">pts</span>
            </div>

            {/* Progress to next tier */}
            {tier.next && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>{tier.name}</span>
                  <span>{tier.next} pts to next tier</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-1000`}
                    style={{ width: `${Math.min(tier.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Redeem info */}
            {canRedeem && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-300 font-medium">₱{discountValue} available to redeem!</span>
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">How Points Work</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: TrendingUp, title: "Earn", desc: "1 point per ₱10 spent" },
              { icon: Trophy, title: "Collect", desc: "100 pts = ₱50 off" },
              { icon: Sparkles, title: "Redeem", desc: "Auto-applied at checkout" },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                  <item.icon className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Points History</h2>

          {data.history.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                <Trophy className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">No points activity yet</p>
              <p className="text-xs text-gray-400 mt-1">Complete a booking to start earning</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/50 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      tx.type === "EARNED" ? "bg-emerald-100" : "bg-red-100"
                    }`}>
                      {tx.type === "EARNED" ? (
                        <Plus className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.description || tx.type}</p>
                      <p className="text-xs text-gray-400">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <Badge
                    variant={tx.type === "EARNED" ? "default" : "destructive"}
                    className={tx.type === "EARNED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      : ""
                    }
                  >
                    {tx.type === "EARNED" ? "+" : "-"}{tx.points} pts
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
