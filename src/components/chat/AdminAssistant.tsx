"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminAIMessage } from "@/lib/admin-ai";

const suggestions = ["Explain the employee GPS tracking flow", "How do I resolve a full booking slot?", "Draft a client update about geolocation testing"];

export function AdminAssistant() {
  const [messages, setMessages] = useState<AdminAIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [includeSnapshot, setIncludeSnapshot] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  async function send() {
    const message = input.trim();
    if (!message || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ message, history: messages.slice(-12), includeSnapshot }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistant unavailable");
      if (!controller.signal.aborted) { setMessages(previous => [...previous, { role: "user", content: message }, { role: "model", content: data.reply }]); setInput(""); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Request failed. Please retry."); }
    finally { pending.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="mx-auto flex max-w-4xl flex-col gap-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Admin AI Assistant</h1><p className="mt-1 text-sm text-muted-foreground">Gemini-powered operations help · Read-only · Taglish friendly</p></div><Button variant="outline" disabled={busy} onClick={() => { setMessages([]); setError(""); setInput(""); }}>New conversation</Button></header>
    <div className="rounded-xl border bg-blue-50 p-3 text-sm text-blue-950">Questions and recent conversation are sent to Google Gemini. Do not enter passwords, API keys, or personal customer details. AI answers may be incorrect; verify before acting.</div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={includeSnapshot} disabled={busy} onChange={event => setIncludeSnapshot(event.target.checked)} className="mt-1" /><span>Include current aggregate booking counts (all-time, by status). This sends counts only—not customer records—to Gemini.</span></label>
    <div role="log" aria-live="polite" aria-label="Assistant conversation" className="max-h-[55dvh] min-h-60 space-y-4 overflow-auto rounded-xl border bg-background p-4">
      {messages.length === 0 && <div className="space-y-3"><p className="text-sm text-muted-foreground">Ask about booking capacity, scanner workflows, tracking, or draft an operations message.</p>{suggestions.map(question => <button key={question} className="block rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setInput(question)}>{question}</button>)}</div>}
      {messages.map((message, index) => <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-xl p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><p className="mb-1 text-xs font-semibold">{message.role === "user" ? "You" : "Admin Assistant"}</p><p className="whitespace-pre-wrap break-words text-sm">{message.content}</p></div></div>)}
      {busy && <p role="status" className="text-sm text-muted-foreground">Asking Gemini…</p>}<div ref={bottom} />
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void send(); }} className="flex items-end gap-2"><textarea aria-label="Ask the admin assistant" value={input} disabled={busy} maxLength={4000} rows={3} onChange={event => setInput(event.target.value)} placeholder="Ask your operations question…" className="min-w-0 flex-1 rounded-xl border bg-background p-3 text-sm" /><Button type="submit" disabled={busy || !input.trim()}>Send</Button></form>
    <p className="text-xs text-muted-foreground">Conversation stays in this page’s memory only. Last 12 messages provide follow-up context. No automatic actions or record changes.</p>
  </div>;
}
