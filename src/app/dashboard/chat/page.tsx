"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, Search, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ChatBooking {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string };
  status: string;
  _count: { chatMessages: number };
  lastMessage?: { message: string; createdAt: string; isFromCustomer: boolean };
}

export default function ChatListPage() {
  const [bookings, setBookings] = useState<ChatBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/bookings?include=chat")
      .then((r) => r.json())
      .then((data) => setBookings(data.filter((b: ChatBooking) => b._count.chatMessages > 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.referenceNumber.toLowerCase().includes(q) ||
      b.customer.name.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Chat</h1>
        <p className="text-sm text-muted-foreground">View and reply to customer messages</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by reference or customer name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageCircle className="mb-3 h-8 w-8" />
            <p className="font-medium">No conversations yet</p>
            <p className="text-sm">Customer messages will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Link key={b.id} href={`/dashboard/chat/${b.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{b.customer.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {b.referenceNumber}
                        </Badge>
                      </div>
                      {b.lastMessage && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {b.lastMessage.isFromCustomer ? "Customer: " : "Staff: "}
                          {b.lastMessage.message}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {b._count.chatMessages} message{b._count.chatMessages !== 1 ? "s" : ""}
                        {b.lastMessage && ` · ${formatDate(b.lastMessage.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
