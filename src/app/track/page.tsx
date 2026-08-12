"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Search, Camera, Luggage } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CameraQRScanner } from "@/components/scanner/CameraQRScanner";

function cleanScanInput(ref: string): string {
  const withoutQuery = ref.split("?")[0].split("#")[0];
  const clean = withoutQuery.includes("/")
    ? withoutQuery.split("/").pop() || ""
    : withoutQuery;
  return clean.trim().toUpperCase();
}

export default function TrackPage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [scanning, setScanning] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reference.trim()) {
      router.push(`/track/${reference.trim().toUpperCase()}`);
    }
  }

  function handleScan(raw: string) {
    const cleanRef = cleanScanInput(raw);
    setScanning(false);
    if (cleanRef) {
      router.push(`/track/${cleanRef}`);
    }
  }

  return (
    <div className="min-h-screen bg-blue-50/50">
      <PublicHeader showBackToHome />

      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 shadow-lg shadow-blue-200">
            <Luggage className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-blue-700">
            Track My Luggage
          </h1>
          <p className="mt-2 text-gray-600">
            Enter your booking reference number to check your luggage status
          </p>
        </div>

        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardHeader>
            <CardTitle>Search by Reference</CardTitle>
            <CardDescription>
              Your reference number was sent via email after booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reference">Booking Reference</Label>
                <div className="flex gap-2">
                  <Input
                    id="reference"
                    placeholder="e.g. DROPFLY-ABC123"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="font-mono uppercase"
                    required
                  />
                  <Button type="submit" className="bg-orange-500 text-white shadow-md hover:bg-orange-600">
                    <Search className="mr-2 h-4 w-4" />
                    Track
                  </Button>
                </div>
              </div>
            </form>

            {scanning ? (
              <div className="mt-6 border-t pt-6">
                <CameraQRScanner
                  onScan={handleScan}
                  onClose={() => setScanning(false)}
                  title="Scan Booking QR"
                  description="Point at the QR code from your confirmation email"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 text-center transition-all hover:border-blue-400 hover:bg-blue-50"
              >
                <Camera className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                <p className="text-sm font-medium text-gray-700">
                  Scan QR Code from your confirmation email
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Use your camera to scan — we&apos;ll look up the booking instantly
                </p>
              </button>
            )}
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
