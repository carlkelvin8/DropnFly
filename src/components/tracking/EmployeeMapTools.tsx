"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Message { id: string; message: string; isFromCustomer: boolean; createdAt: string; sender?: { name: string } | null }
interface Route { distance: number; duration: number; legs: { steps: { distance: number; maneuver: { instruction: string } }[] }[] }

export function EmployeeMapTools({ reference, customer, phone, latitude, longitude, destination }: {
  reference: string; customer: string; phone?: string; latitude: number | null; longitude: number | null; destination: { lat: number; lng: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const chatDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = chatDialog.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [route, setRoute] = useState<Route | null>(null);
  const [routeKey, setRouteKey] = useState("");
  const destLat = destination?.lat;
  const destLng = destination?.lng;
  const currentKey = `${latitude},${longitude};${destLat},${destLng}`;
  const currentRoute = routeKey === currentKey ? route : null;
  const endpoint = `/api/public/bookings/${encodeURIComponent(reference)}/chat?viewer=staff`;
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store", signal: abort.signal });
        if (!res.ok) throw new Error("Could not load chat");
        setMessages(await res.json());
      } catch { if (!abort.signal.aborted) setError("Could not load chat. Please retry."); }
    };
    if (!open) return;
    void load();
    const timer = setInterval(load, 5000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [endpoint, open]);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || latitude == null || longitude == null || destLat == null || destLng == null) return;
    const abort = new AbortController();
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${longitude},${latitude};${destLng},${destLat}?steps=true&access_token=${encodeURIComponent(token)}`, { signal: abort.signal })
      .then(r => r.ok ? r.json() : null).then(data => { if (!abort.signal.aborted) { setRoute(data?.routes?.[0] || null); setRouteKey(currentKey); } }).catch(() => {});
    return () => abort.abort();
  }, [latitude, longitude, destLat, destLng, currentKey]);
  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true); setError("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: draft }) });
      if (!res.ok) throw new Error("Message not sent");
      const message = await res.json();
      setMessages(previous => [...previous.filter(m => m.id !== message.id), message]); setDraft("");
    } catch { setError("Message not sent. Please retry."); } finally { setSending(false); }
  }
  return <div className="space-y-3 rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-center gap-3"><span className="font-semibold">{customer}</span>
      {phone && <Button variant="outline" asChild><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>Call Customer</a></Button>}
      <Button onClick={() => setOpen(true)}>Chat with Customer</Button>
      {destination && <Button variant="outline" asChild><a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`}>Open Navigation</a></Button>}
    </div>
    <details><summary className="cursor-pointer text-sm font-medium">Turn-by-turn directions {currentRoute && `· ${(currentRoute.distance / 1000).toFixed(1)} km · ${Math.ceil(currentRoute.duration / 60)} min estimated`}</summary>
      {currentRoute ? <ol className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">{currentRoute.legs.flatMap(leg => leg.steps).map((step, index) => <li key={index}>{index + 1}. {step.maneuver.instruction} · {Math.round(step.distance)} m</li>)}</ol> : <p className="mt-2 text-xs text-muted-foreground">Directions require live GPS, destination coordinates, and a configured Mapbox token. Use Open Navigation as an alternative. ETA is an estimate, not guaranteed.</p>}
    </details>
    <dialog ref={chatDialog} aria-label="Customer chat" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[calc(100dvh_-_2rem)] overflow-hidden rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50">
      <section className="flex max-h-[calc(100dvh_-_2rem)] flex-col gap-4 p-4"><div className="flex shrink-0 items-center justify-between gap-3"><h2 className="min-w-0 break-words font-semibold">{customer} · {reference}</h2><Button className="shrink-0" variant="ghost" onClick={() => setOpen(false)}>Close</Button></div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">{messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}{messages.map(message => <div key={message.id} className={`flex ${message.isFromCustomer ? "justify-start" : "justify-end"}`}><div className={`max-w-[85%] break-words rounded-xl p-3 text-sm ${message.isFromCustomer ? "bg-muted" : "bg-orange-100 text-orange-950"}`}><p>{message.message}</p><p className="mt-1 text-[10px]">{message.isFromCustomer ? customer : message.sender?.name || "Employee"} · {new Date(message.createdAt).toLocaleTimeString()}</p></div></div>)}</div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <form className="flex shrink-0 gap-2" onSubmit={event => { event.preventDefault(); void send(); }}><input aria-label="Message customer" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border p-2" placeholder="Type a message…" /><Button disabled={sending || !draft.trim()} type="submit">Send</Button></form>
    </section></dialog>
  </div>;
}
