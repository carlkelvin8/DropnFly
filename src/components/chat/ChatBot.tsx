"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, ChevronDown } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
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
        "Hi! I'm the Dropnfly assistant. How can I help you with your luggage today? You can ask me about booking, tracking, or our services!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!atBottom);
  };

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
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
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-600/30 transition-shadow hover:shadow-2xl hover:shadow-blue-600/40"
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
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3.5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Dropnfly Assistant</p>
                    <p className="text-[11px] text-white/70">AI-powered help</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4"
              >
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
                            ? "bg-gradient-to-br from-blue-600 to-violet-600"
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
                            ? "rounded-tr-none bg-gradient-to-r from-blue-600 to-violet-600 text-white"
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
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    disabled={loading}
                    className="flex-1 rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-background disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
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
