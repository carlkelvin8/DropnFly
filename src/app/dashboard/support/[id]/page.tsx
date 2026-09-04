"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowLeft, HeadphonesIcon, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface SupportMsg {
  id: string;
  message: string;
  isFromCustomer: boolean;
  createdAt: string;
  sender?: { id: string; name: string; role: string } | null;
}

export default function SupportThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [customerName, setCustomerName] = useState("Anonymous");
  const [status, setStatus] = useState("OPEN");
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/support-chats/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setCustomerName(data.customerName || "Anonymous");
    setStatus(data.status);
    setMessages((prev) =>
      prev.length === data.messages.length ? prev : data.messages
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/support-chats/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setCustomerName(data.customerName || "Anonymous");
        setStatus(data.status);
        setMessages(data.messages);
      } catch {
        // ignore transient polling errors
      }
    };
    void load();
    const interval = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight });
  }, [messages.length]);

  async function sendMessage() {
    const message = text.trim();
    if (!message || sending || status !== "OPEN") return;
    setSending(true);
    const optimistic: SupportMsg = {
      id: `local-${Date.now()}`,
      message,
      isFromCustomer: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    try {
      const res = await fetch(`/api/support-chats/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to send the reply.");
      }
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      await poll();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error(err instanceof Error ? err.message : "Unable to send the reply.");
    } finally {
      setSending(false);
    }
  }

  async function toggleStatus() {
    const next = status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      const res = await fetch(`/api/support-chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      setStatus(next);
      toast.success(next === "OPEN" ? "Chat reopened" : "Chat closed");
    } catch {
      toast.error("Unable to update the chat status.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/support"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to General Support
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{customerName}</h1>
            <Badge variant={status === "OPEN" ? "default" : "secondary"}>
              {status === "OPEN" ? "Open" : "Closed"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            General support chat — no booking attached
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleStatus}
          disabled={messages.length === 0}
        >
          {status === "OPEN" ? (
            <>
              <Lock className="mr-2 h-4 w-4" /> Close Chat
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" /> Reopen Chat
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div
            ref={chatBoxRef}
            className="flex h-[60vh] flex-col gap-4 overflow-y-auto p-4"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <HeadphonesIcon className="mb-3 h-8 w-8" />
                <p className="font-medium">No messages yet</p>
                <p className="text-sm">The customer will be notified once you send your first reply</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.isFromCustomer ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.isFromCustomer
                        ? "rounded-tl-none bg-muted"
                        : "rounded-tr-none bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.message}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {m.isFromCustomer
                      ? `${customerName} · ${formatDate(m.createdAt)}`
                      : `${m.sender?.name || "You"} · ${formatDate(m.createdAt)}`}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2 border-t p-3">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                status === "OPEN"
                  ? "Type your reply..."
                  : "This chat is closed"
              }
              disabled={sending || status !== "OPEN"}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!text.trim() || sending || status !== "OPEN"}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}