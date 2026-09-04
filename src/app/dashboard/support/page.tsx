"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, HeadphonesIcon, Search, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SupportChatListItem {
  id: string;
  customerName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  unreadCustomerCount: number;
  lastMessage?: { message: string; createdAt: string; isFromCustomer: boolean } | null;
}

export default function SupportChatListPage() {
  const [chats, setChats] = useState<SupportChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/support-chats", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (active && Array.isArray(data)) setChats(data);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    void load();
    const poll = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, []);

  const filtered = chats.filter((c) => {
    const q = search.toLowerCase();
    return (
      (statusFilter === "all" || c.status === statusFilter) &&
      c.customerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Support</h1>
        <p className="text-sm text-muted-foreground">
          Live chat from customers with no booking — reply right here
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <HeadphonesIcon className="mb-3 h-8 w-8" />
            <p className="font-medium">No support chats yet</p>
            <p className="text-sm">When a customer starts a chat without a booking, it will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/dashboard/support/${c.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{c.customerName}</p>
                        <Badge variant={c.status === "OPEN" ? "default" : "secondary"} className="text-xs">
                          {c.status === "OPEN" ? "Open" : "Closed"}
                        </Badge>
                        {c.unreadCustomerCount > 0 && (
                          <Badge className="bg-red-500 text-[10px]">{c.unreadCustomerCount} Unread</Badge>
                        )}
                      </div>
                      {c.lastMessage && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {c.lastMessage.isFromCustomer ? "Customer: " : "You: "}
                          {c.lastMessage.message}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.messageCount} message{c.messageCount !== 1 ? "s" : ""}
                        {c.lastMessage && ` · last ${formatDate(c.lastMessage.createdAt)}`}
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