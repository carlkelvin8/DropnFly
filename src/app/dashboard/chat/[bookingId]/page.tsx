"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface Message {
  id: string;
  message: string;
  isFromCustomer: boolean;
  createdAt: string;
}

interface BookingInfo {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string };
  status: string;
}

export default function ChatRoomPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bookingId) return;
    Promise.all([
      fetch(`/api/bookings/${bookingId}`).then((r) => r.json()),
      fetch(`/api/bookings/${bookingId}/chat`).then((r) => r.json()),
    ]).then(([b, m]) => {
      setBooking(b);
      setMessages(m);
    }).catch(() => toast.error("Failed to load chat"));
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
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
          <div className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
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
                    {msg.isFromCustomer ? " · Customer" : " · You"}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 flex gap-2 border-t pt-4">
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
