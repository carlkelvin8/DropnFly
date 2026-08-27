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
  lastMessage?: { message: string; createdAt: string; isFromCustomer: boolean; isRead: boolean };
  unreadCustomerCount: number;
  customerMessageCount: number;
  staffMessageCount: number;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
}

export default function ChatListPage() {
  const [bookings, setBookings] = useState<ChatBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const loadConversations = () => fetch("/api/bookings?include=chat", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!active) return;
        const conversations = Array.isArray(data) ? data.filter((b: ChatBooking) => b._count?.chatMessages > 0) : [];
        conversations.sort((a: ChatBooking, b: ChatBooking) => new Date(b.lastMessage?.createdAt || 0).getTime() - new Date(a.lastMessage?.createdAt || 0).getTime());
        setBookings(conversations);
      })
      .catch(() => { if (active) setBookings([]); })
      .finally(() => { if (active) setLoading(false); });
    void loadConversations();
    const poll = window.setInterval(loadConversations, 3000);
    return () => { active = false; window.clearInterval(poll); };
  }, []);

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const lastCustomer = b.lastCustomerMessageAt ? new Date(b.lastCustomerMessageAt).getTime() : 0;
    const lastStaff = b.lastStaffMessageAt ? new Date(b.lastStaffMessageAt).getTime() : 0;
    const awaitingResponse = b.customerMessageCount > 0 && lastCustomer > lastStaff;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "unread" && b.unreadCustomerCount > 0) ||
      (statusFilter === "read" && b.customerMessageCount > 0 && b.unreadCustomerCount === 0) ||
      (statusFilter === "no-response" && awaitingResponse) ||
      (statusFilter === "responded" && b.staffMessageCount > 0 && lastStaff >= lastCustomer);
    return matchesStatus && (
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

      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by reference or customer name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="all">All conversations</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="no-response">No response</option>
          <option value="responded">Responded</option>
        </select>
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
                      <div className="mt-1 flex flex-wrap gap-1">
                        {b.unreadCustomerCount > 0 && <Badge className="bg-red-500 text-[10px]">{b.unreadCustomerCount} Unread</Badge>}
                        {b.customerMessageCount > 0 && new Date(b.lastCustomerMessageAt || 0).getTime() > new Date(b.lastStaffMessageAt || 0).getTime() && <Badge variant="secondary" className="text-[10px]">No Response</Badge>}
                        {b.staffMessageCount > 0 && new Date(b.lastStaffMessageAt || 0).getTime() >= new Date(b.lastCustomerMessageAt || 0).getTime() && <Badge variant="outline" className="text-[10px]">Responded</Badge>}
                      </div>
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
