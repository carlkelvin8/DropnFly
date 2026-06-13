"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Brain,
  RefreshCw,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Prediction {
  label: string;
  value: number;
  confidence: number;
}

interface PredictionsResponse {
  predictions: Prediction[];
  insights: string[];
  generatedAt: string;
}

export default function PredictionsPage() {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchPredictions() {
    try {
      const res = await fetch("/api/analytics/predictions");
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to generate predictions");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => fetchPredictions()); }, []);

  function getConfidenceColor(confidence: number) {
    if (confidence >= 70) return "from-green-500 to-emerald-400";
    if (confidence >= 40) return "from-yellow-500 to-amber-400";
    return "from-red-500 to-rose-400";
  }

  function getConfidenceBorder(confidence: number) {
    if (confidence >= 70) return "border-t-green-500";
    if (confidence >= 40) return "border-t-yellow-500";
    return "border-t-red-500";
  }

  function getConfidenceIconBg(confidence: number) {
    if (confidence >= 70) return "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400";
    if (confidence >= 40) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400";
    return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
  }

  function formatValue(label: string, value: number) {
    if (label.toLowerCase().includes("revenue")) {
      return formatCurrency(value);
    }
    if (label.toLowerCase().includes("%")) {
      return `${value.toFixed(1)}%`;
    }
    if (label.toLowerCase().includes("hour")) {
      const h = Math.round(value);
      return `${h.toString().padStart(2, "0")}:00`;
    }
    return value.toFixed(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/analytics">&larr; Back</Link>
          </Button>
          <h1 className="text-2xl font-bold">AI Predictions</h1>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
            <Brain className="h-3.5 w-3.5" />
            Gemini AI
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setLoading(true); setError(""); fetchPredictions(); }}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </div>

      {error && (
        <Card className="border-t-2 border-t-yellow-500 border-l-0 border-r-0 border-b-0 shadow-sm">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                Prediction unavailable
              </p>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                {error}
              </p>
              <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                Add <code className="rounded bg-yellow-100 px-1.5 py-0.5 font-mono text-xs dark:bg-yellow-900">GEMINI_API_KEY</code> to your .env file
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !data && !error && (
        <Card className="border-t-2 border-t-blue-500">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
              <Brain className="h-6 w-6 animate-pulse text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-medium">Analyzing data and generating predictions...</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Prediction Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.predictions.map((pred, i) => (
              <Card key={i} className={`border-t-2 ${getConfidenceBorder(pred.confidence)}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {pred.label}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${getConfidenceIconBg(pred.confidence)}`}>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatValue(pred.label, pred.value)}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all ${getConfidenceColor(pred.confidence)}`}
                        style={{ width: `${pred.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {pred.confidence}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* AI Insights */}
          <Card className="border-t-2 border-t-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <div className="rounded-lg bg-amber-100 p-1.5 dark:bg-amber-900/30">
                  <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.insights.map((insight, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white shadow-sm">
                      {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed">{insight}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Timestamp */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="h-px w-12 bg-border" />
            <span>Predictions generated at {new Date(data.generatedAt).toLocaleString()}</span>
            <div className="h-px w-12 bg-border" />
          </div>
        </>
      )}
    </div>
  );
}
