"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, ChevronDown, HeadphonesIcon, ArrowLeft, UserRound, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SupportMsg {
  id: string;
  message: string;
  isFromCustomer: boolean;
  createdAt: string;
  sender?: { id: string; name: string; role: string } | null;
}

interface SupportThread {
  id: string;
  customerName: string | null;
  status: string;
  messages: SupportMsg[];
}

function normalizeSupportThread(value: unknown): SupportThread | null {
  if (!value || typeof value !== "object") return null;
  const thread = value as Partial<SupportThread>;
  if (typeof thread.id !== "string") return null;
  return {
    id: thread.id,
    customerName: typeof thread.customerName === "string" ? thread.customerName : null,
    status: typeof thread.status === "string" ? thread.status : "OPEN",
    messages: Array.isArray(thread.messages) ? thread.messages : [],
  };
}

const SUPPORT_TOKEN_KEY = "dropnfly_support_token";

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-blue-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-none bg-muted px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm the Dropnfly assistant. How can I help you with your luggage today? Ask me about booking, tracking, or pricing — or tap \"Talk to an agent\" to chat with a real person (no booking needed).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [supportMode, setSupportMode] = useState<"connect" | "chat" | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thread, supportMode, loading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!atBottom);
  };

  const ensureToken = useCallback(() => {
    if (token) return token;
    const existing = window.localStorage.getItem(SUPPORT_TOKEN_KEY);
    if (existing) {
      setToken(existing);
      return existing;
    }
    const fresh = (crypto.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
    window.localStorage.setItem(SUPPORT_TOKEN_KEY, fresh);
    setToken(fresh);
    return fresh;
  }, [token]);

  const startLiveAgent = useCallback(() => {
    ensureToken();
    setSupportMode("connect");
  }, [ensureToken]);

  const renewConversation = useCallback(async () => {
    const oldToken = token || window.localStorage.getItem(SUPPORT_TOKEN_KEY) || "";
    if (oldToken) {
      try {
        await fetch("/api/support-chat", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: oldToken, action: "close" }),
        });
      } catch { /* best-effort close */ }
    }
    const fresh = (crypto.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
    window.localStorage.setItem(SUPPORT_TOKEN_KEY, fresh);
    setToken(fresh);
    setThread(null);
    setSupportMode("connect");
  }, [token]);

  const LIVE_AGENT_KEYWORDS = /\b(live agent|human|talk to someone|real person|speak to|speak with|talk to a|chat with staff|agent|support staff|customer service|actual person|staff)\b/i;

  async function connectToAgent() {
    if (sending) return;
    setSending(true);
    setSendError("");
    const sessionToken = ensureToken();
    // Pre-register the customer's name so staff can see who is chatting.
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: sessionToken,
          name: customerName.trim() || undefined,
          message: "Hello! I'd like to chat with a support agent.",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to start the chat.");
      }
      const data = await res.json();
      const nextThread = normalizeSupportThread(data.thread);
      if (nextThread) setThread(nextThread);
      setNameSaved(Boolean(customerName.trim()));
      setSupportMode("chat");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unable to start the chat. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Poll for staff replies while in live-agent chat.
  useEffect(() => {
    if (supportMode !== "chat" || !token) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/support-chat?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const nextThread = normalizeSupportThread(data.thread);
        if (active && nextThread) {
          setThread((prev) =>
            prev && (prev.messages || []).length === nextThread.messages.length ? prev : nextThread
          );
        }
      } catch {
        // ignore transient polling errors
      }
    };
    void load();
    const id = window.setInterval(load, 3000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [supportMode, token]);

  async function sendSupportMessage(text: string) {
    if (sending) return;
    setSending(true);
    setSendError("");
    const optimistic: SupportMsg = {
      id: `local-${Date.now()}`,
      message: text,
      isFromCustomer: true,
      createdAt: new Date().toISOString(),
    };
    const sessionToken = ensureToken();
    setThread((prev) =>
      prev ? { ...prev, messages: [...(prev.messages || []), optimistic] } : { id: "", customerName: null, status: "OPEN", messages: [optimistic] }
    );
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken, name: customerName.trim() || undefined, message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send your message.");
      const nextThread = normalizeSupportThread(data.thread);
      if (nextThread) setThread(nextThread);
      if (!nameSaved && nextThread?.customerName) {
        setCustomerName(nextThread.customerName);
        setNameSaved(true);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unable to send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || sending) return;

    if (supportMode === "chat") {
      setInput("");
      await sendSupportMessage(text);
      return;
    }

    setInput("");

    if (LIVE_AGENT_KEYWORDS.test(text) && supportMode !== "connect") {
      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content:
            "I can answer FAQs right here, but if you'd like to chat with a real person, I'll connect you to our support team now — no booking needed.",
        },
      ]);
      startLiveAgent();
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Sorry, I'm having trouble responding right now. Please try again.",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-blue-500 text-white shadow-xl shadow-orange-500/30 transition-shadow hover:shadow-2xl hover:shadow-orange-500/40"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <MessageCircle className="h-6 w-6" />
        </motion.div>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Chat panel */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-6 right-6 z-50 flex h-[540px] w-[380px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:h-[600px] sm:w-[420px]"
            >
              {/* Header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-blue-500 px-4 py-3.5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    {supportMode ? <HeadphonesIcon className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {supportMode ? "Live Support" : "Dropnfly Assistant"}
                    </p>
                    <p className="text-[11px] text-white/70">
                      {supportMode === "chat"
                        ? "Connected — a real person will reply shortly"
                        : supportMode === "connect"
                          ? "No booking required"
                          : "AI-powered help"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {supportMode && (
                    <button
                      onClick={renewConversation}
                      title="New conversation"
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4"
              >
                {supportMode === "chat" ? (
                  <div className="space-y-4">
                    {(thread?.messages || []).map((msg) => {
                      const isCustomer = msg.isFromCustomer;
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={`flex items-start gap-2.5 ${isCustomer ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              isCustomer
                                ? "bg-gradient-to-br from-orange-500 to-blue-500"
                                : "bg-muted"
                            }`}
                          >
                            {isCustomer ? (
                              <User className="h-4 w-4 text-white" />
                            ) : (
                              <HeadphonesIcon className="h-4 w-4 text-foreground" />
                            )}
                          </div>
                          <div className="max-w-[80%]">
                            {!isCustomer && (
                              <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                                {msg.sender?.name || "Support Agent"}
                              </p>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isCustomer
                                  ? "rounded-tr-none bg-gradient-to-r from-orange-500 to-blue-500 text-white"
                                  : "rounded-tl-none bg-muted"
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    {!thread && (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                        Connecting you to our support team...
                      </div>
                    )}
                  </div>
                ) : supportMode === "connect" ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <HeadphonesIcon className="h-5 w-5 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                        Chat with a Live Agent
                      </p>
                    </div>
                    <p className="mb-3 text-xs text-blue-700/80 dark:text-blue-300/70">
                      No booking needed — a real support agent will chat with you right here. Share your name so they know who they are talking to (optional).
                    </p>
                    <div className="mb-3 flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              connectToAgent();
                            }
                          }}
                          placeholder="Your name (optional)"
                          maxLength={120}
                          disabled={sending}
                          className="w-full rounded-xl border bg-white/80 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:bg-black/30"
                        />
                      </div>
                      <button
                        onClick={connectToAgent}
                        disabled={sending}
                        className="shrink-0 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
                      >
                        {sending ? "..." : "Start Chat"}
                      </button>
                    </div>
                    <button
                      onClick={() => setSupportMode(null)}
                      disabled={sending}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-300"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Back to AI assistant (FAQ)
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`flex items-start gap-2.5 ${
                          msg.role === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            msg.role === "user"
                              ? "bg-gradient-to-br from-orange-500 to-blue-500"
                              : "bg-muted"
                          }`}
                        >
                          {msg.role === "user" ? (
                            <User className="h-4 w-4 text-white" />
                          ) : (
                            <Bot className="h-4 w-4 text-foreground" />
                          )}
                        </div>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "rounded-tr-none bg-gradient-to-r from-orange-500 to-blue-500 text-white"
                              : "rounded-tl-none bg-muted"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </motion.div>
                    ))}

                    {loading && <TypingIndicator />}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Scroll to bottom button */}
              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={() => scrollToBottom()}
                    className="absolute bottom-20 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-colors hover:bg-muted"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Input */}
              <div className="border-t p-4">
                {supportMode !== "chat" && (
                  <button
                    onClick={supportMode === "connect" ? undefined : startLiveAgent}
                    disabled={supportMode === "connect"}
                    className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-1.5 text-xs transition-colors ${
                      supportMode === "connect"
                        ? "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-950/30"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"
                    }`}
                  >
                    <HeadphonesIcon className="h-3.5 w-3.5" />
                    {supportMode === "connect"
                      ? "Enter your name above to start"
                      : "Talk to an agent"}
                  </button>
                )}
                {sendError && (
                  <p className="mb-2 text-[11px] text-red-500">{sendError}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      supportMode === "chat"
                        ? "Type your message..."
                        : supportMode === "connect"
                          ? "Enter your name to connect"
                          : "Type your message..."
                    }
                    disabled={loading || sending || supportMode === "connect"}
                    className="flex-1 rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-background disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading || sending || supportMode === "connect"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-blue-500 text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
