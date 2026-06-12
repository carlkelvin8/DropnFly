"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Printer, ArrowLeft, Luggage } from "lucide-react";
import Link from "next/link";

import { toast } from "sonner";

interface Booking {
  id: string;
  referenceNumber: string;
  customer: { id: string; name: string; email: string; phone: string };
  pickupLocation: string;
  dropOffLocation: string;
  numberOfBags: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  checkIn: string;
}

export default function ReceiptPage() {
  const params = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/bookings/${params.id}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setBooking(data); })
      .catch(() => { if (!abort.signal.aborted) toast.error("Failed to load booking"); });
    return () => abort.abort();
  }, [params.id]);

  function handlePrint() {
    window.print();
  }

  if (!booking) {
    return (
      <div className="p-8">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="no-print flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard/bookings/${params.id}`}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold">Receipt</h1>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="receipt-content">
        <Card className="border-2">
          <CardHeader className="border-b bg-muted/30 text-center">
            <div className="mb-2 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600">
                <Luggage className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl">Dropnfly</CardTitle>
            <p className="text-xs text-muted-foreground">Luggage Storage &amp; Delivery</p>
            <p className="text-xs text-muted-foreground">Metro Manila, Philippines</p>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-950/20">
              <p className="text-xs text-muted-foreground">RECEIPT</p>
              <p className="mt-1 text-lg font-bold tracking-wider">{booking.referenceNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{booking.customer.name}</p>
                <p className="text-muted-foreground">{booking.customer.email}</p>
                <p className="text-muted-foreground">{booking.customer.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(booking.createdAt)}</p>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{booking.status.replace("_", " ")}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Service</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">
                      <p className="font-medium">Luggage Storage</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.pickupLocation} → {booking.dropOffLocation}
                      </p>
                    </td>
                    <td className="py-2 text-right">{booking.numberOfBags}</td>
                    <td className="py-2 text-right">{formatCurrency(booking.totalPrice)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right">{booking.numberOfBags}</td>
                    <td className="pt-2 text-right">{formatCurrency(booking.totalPrice)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t pt-4 text-center text-xs text-muted-foreground">
              <p>Thank you for choosing Dropnfly!</p>
              <p className="mt-1">For inquiries: hello@dropnfly.ph | +63 (2) 8123 4567</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
