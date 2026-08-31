"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

interface Message {
  id: string;
  message: string;
  isFromCustomer: boolean;
  createdAt: string;
  sender?: { name: string; role: string } | null;
}

interface BookingInfo {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string };
  status: string;
}

interface ChatPage {
  messages: Message[];
  total: number;
}

const MESSAGES_PER_PAGE = 25;

export default function ChatRoomPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const totalRef = useRef(0);
  const pendingScrollRef = useRef<"top" | "bottom" | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / MESSAGES_PER_PAGE));

  const applyNewest = useCallback((data: ChatPage, forceJump: boolean) => {
    const newNewest = Math.max(1, Math.ceil(data.total / MESSAGES_PER_PAGE));
    const oldNewest = Math.max(1, Math.ceil(totalRef.current / MESSAGES_PER_PAGE));
    totalRef.current = data.total;
    setTotal(data.total);
    if (forceJump || pageRef.current === oldNewest) {
      if (forceJump) pendingScrollRef.current = "bottom";
      pageRef.current = newNewest;
      setPage(newNewest);
      setMessages(data.messages);
    }
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let active = true;

    const fetchChat = (init: RequestInit = {}) =>
      fetch(`/api/bookings/${bookingId}/chat?limit=${MESSAGES_PER_PAGE}`, init)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); });

    const boot = async () => {
      try {
        const [b, chat] = await Promise.all([
          fetch(`/api/bookings/${bookingId}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
          fetchChat(),
        ]);
        if (!active) return;
        setBooking(b);
        applyNewest(chat, true);
      } catch {
        if (active) toast.error("Failed to load chat");
      }
    };
    void boot();

    const poll = window.setInterval(() => {
      fetchChat()
        .then((chat) => { if (active) applyNewest(chat, false); })
        .catch(() => {});
    }, 2000);

    return () => { active = false; window.clearInterval(poll); };
  }, [bookingId, applyNewest]);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el || !pendingScrollRef.current) return;
    el.scrollTop = pendingScrollRef.current === "bottom" ? el.scrollHeight : 0;
    pendingScrollRef.current = null;
  }, [messages, page]);

  function handleChatScroll() {
    const el = chatBoxRef.current;
    if (!el) return;
    pendingScrollRef.current = null;
  }

  async function goToPage(p: number) {
    if (p < 1 || p > totalPages || p === pageRef.current) return;
    try {
      const offset = (p - 1) * MESSAGES_PER_PAGE;
      const res = await fetch(`/api/bookings/${bookingId}/chat?limit=${MESSAGES_PER_PAGE}&offset=${offset}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as ChatPage;
      totalRef.current = data.total;
      setTotal(data.total);
      pageRef.current = p;
      setPage(p);
      setMessages(data.messages);
      const newest = Math.max(1, Math.ceil(data.total / MESSAGES_PER_PAGE));
      pendingScrollRef.current = p === newest ? "bottom" : "top";
    } catch {
      toast.error("Failed to load messages");
    }
  }

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error();
      const chat = await fetch(`/api/bookings/${bookingId}/chat?limit=${MESSAGES_PER_PAGE}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); });
      applyNewest(chat, true);
      setText("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!booking) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/chat">&larr; Back</Link>
        </Button>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">{booking.customer.name}</p>
            <p className="text-xs text-muted-foreground">
              {booking.referenceNumber} · <Badge variant="outline" className="text-xs">{booking.status}</Badge>
            </p>
          </div>
        </div>
      </div>

      <Card className="mt-4 flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-4">
          <div ref={chatBoxRef} onScroll={handleChatScroll} className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 && total === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">No messages yet. Start the conversation.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isFromCustomer ? "" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.isFromCustomer
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={`mt-1 text-[10px] ${msg.isFromCustomer ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                    {formatDate(msg.createdAt)}
                    {msg.isFromCustomer ? " · Customer" : ` · ${msg.sender?.name || "Staff"}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {total > 0 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={goToPage} />
          )}

          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Type your reply..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <Button onClick={sendMessage} disabled={!text.trim() || sending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}