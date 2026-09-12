"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveMap } from "@/components/tracking/LiveMap";
import { NAIA_TERMINAL_COORDS } from "@/components/booking/constants";
import {
  ChevronLeft,
  Clock,
  MapPin,
  Map,
  User,
  Bike,
  Car,
  Truck,
  MessageCircle,
  Send,
  Loader2,
} from "lucide-react";

interface Rider {
  id: string;
  name: string;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
  profilePic: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
}

interface BookingPublic {
  id: string;
  referenceNumber: string;
  pickupLocation: string;
  dropOffLocation: string;
  status: string;
  checkIn: string;
  pickupStartedAt: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropOffLat: number | null;
  dropOffLng: number | null;
  customer: { name: string; phone: string };
}

function VehicleIcon({ type }: { type: string | null }) {
  if (!type) return <Car className="h-4 w-4" />;
  const t = type.toLowerCase();
  if (t.includes("motor") || t.includes("bike")) return <Bike className="h-4 w-4" />;
  if (t.includes("truck") || t.includes("van")) return <Truck className="h-4 w-4" />;
  return <Car className="h-4 w-4" />;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LiveTrackingPage() {
  const params = useParams();
  const [booking, setBooking] = useState<BookingPublic | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [employeeLoc, setEmployeeLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; message: string; isFromCustomer: boolean; createdAt: string; sender?: { name: string; role?: string } | null }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatStickToBottomRef = useRef(true);
  const lastChatMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setLoading(true);
      setBooking(null);
      setRider(null);
      setEmployeeLoc(null);
      try {
        const bookingRes = await fetch(`/api/public/bookings/${encodeURIComponent(String(params.reference))}`, { cache: "no-store" });
        if (!bookingRes.ok) throw new Error(bookingRes.status === 404 ? "Booking not found" : "Failed to load booking");
        const b = await bookingRes.json();

        // Rider is only revealed after the employee started the leg (server-gated).
        const riderRes = await fetch(`/api/public/bookings/${encodeURIComponent(String(params.reference))}/rider`, { cache: "no-store" });
        let r: Rider | null = null;
        if (riderRes.ok) {
          const j = await riderRes.json();
          if (j.rider) r = j.rider;
        }
        if (cancelled) return;
        setBooking(b);
        setRider(r);
        if (r && r.currentLat != null && r.currentLng != null) {
          setEmployeeLoc({ lat: r.currentLat, lng: r.currentLng });
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load tracking data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.reference]);

  const hasStarted = Boolean(booking?.pickupStartedAt);

  // Poll the rider's live location only after the employee started the leg.
  useEffect(() => {
    if (!hasStarted || !rider?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tracking/location/${rider.id}?reference=${encodeURIComponent(String(params.reference))}`);
        if (!res.ok) return;
        const loc = await res.json();
        if (loc.currentLat != null && loc.currentLng != null) {
          setEmployeeLoc({ lat: loc.currentLat, lng: loc.currentLng });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [hasStarted, rider?.id, params.reference]);

  useEffect(() => {
    if (!chatOpen) return;
    let active = true;
    const loadMessages = () => fetch(`/api/public/bookings/${params.reference}/chat`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((msgs) => {
        if (!active || !Array.isArray(msgs)) return;
        const lastId = msgs.length ? String(msgs[msgs.length - 1].id) : "";
        if (lastId === lastChatMessageIdRef.current) return;
        lastChatMessageIdRef.current = lastId;
        setChatMessages(msgs);
      })
      .catch(() => {});
    void loadMessages();
    const poll = window.setInterval(loadMessages, 2000);
    return () => { active = false; window.clearInterval(poll); };
  }, [chatOpen, params.reference]);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el || !chatStickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatOpen]);

  function handleChatScroll() {
    const el = chatBoxRef.current;
    if (!el) return;
    chatStickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`/api/public/bookings/${params.reference}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, isFromCustomer: true }),
      });
      if (res.ok) {
        const msg = await res.json();
        setChatMessages((prev) => [...prev, msg]);
      }
    } catch {}
    setChatLoading(false);
  }

  // Destination pins: exact lat/lng when present, else NAIA terminal.
  const pickupTerminalForMap = booking ? booking.pickupLocation.split(" - ")[0].trim() : "";
  const dropoffTerminalForMap = booking ? booking.dropOffLocation.split(" - ")[0].trim() : "";
  const pickupCoordsForMap = booking?.pickupLat != null && booking?.pickupLng != null
    ? { lat: booking.pickupLat, lng: booking.pickupLng }
    : pickupTerminalForMap ? NAIA_TERMINAL_COORDS[pickupTerminalForMap] : null;
  const dropoffCoordsForMap = booking?.dropOffLat != null && booking?.dropOffLng != null
    ? { lat: booking.dropOffLat, lng: booking.dropOffLng }
    : dropoffTerminalForMap ? NAIA_TERMINAL_COORDS[dropoffTerminalForMap] : null;

  let distance: number | null = null;
  let eta: string | null = null;
  if (hasStarted && employeeLoc && booking) {
    const isDeliveryPhase = booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED";
    const dest = isDeliveryPhase ? dropoffCoordsForMap : pickupCoordsForMap;
    if (dest) {
      const base = haversine(employeeLoc.lat, employeeLoc.lng, dest.lat, dest.lng);
      const d = base * 1.35;
      distance = d;
      const minsOfDay = (() => { try { const p = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila", hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).formatToParts(new Date()); const hh=Number(p.find(x=>x.type==="hour")?.value||"12"); if((hh>=7&&hh<=9)||(hh>=17&&hh<=20)) return 0.7; if(hh>=22||hh<=5) return 1.25; return 1.0; } catch { return 1.0; } })();
      const mins = Math.round((d / (30 * minsOfDay)) * 60);
      if (mins <= 1) eta = "1 min"; else if (mins < 60) eta = `${mins} mins`; else { const h=Math.floor(mins/60); const m=mins%60; eta=m?`${h}h ${m}m`:`${h}h`; }
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <p className="font-medium text-red-600">{loadError}</p>
            <p className="text-sm text-muted-foreground">Check your tracking number or open <Link href={`/track/${params.reference}`} className="underline">/track/{String(params.reference)}</Link>.</p>
            <Button asChild variant="outline"><Link href="/track">Back to Tracking</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (loading && !booking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading tracking data...</p>
      </div>
    );
  }
  if (!booking) return null;

  const statusLabel = booking.status === "OUT_FOR_DELIVERY" ? "Out for Delivery"
    : booking.status === "IN_STORAGE" ? "In Storage"
    : booking.status.replace("_", " ");

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Dropnfly</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href={`/track/${params.reference}`} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 shadow-md shadow-blue-200">
            <Map className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-xl font-bold text-transparent">
              Live Tracking
            </h1>
            <p className="font-mono text-sm text-blue-700">{booking.referenceNumber}</p>
          </div>
          {eta && (
            <Badge variant="secondary" className="ml-auto text-xs gap-1">
              <Clock className="h-3 w-3" /> ETA: {eta}
            </Badge>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {!hasStarted ? (
              <Card className="overflow-hidden border-t-4 border-amber-400 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-800">Waiting for your rider to start</p>
                      <p className="text-xs text-muted-foreground">
                        Live tracking will appear here once the employee assigned to your booking begins your {booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED" ? "delivery" : "pickup"}.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Pickup</p>
                      <p className="text-sm font-medium">{booking.pickupLocation}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Drop-off</p>
                      <p className="text-sm font-medium">{booking.dropOffLocation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-hidden rounded-xl border shadow-lg">
                <LiveMap
                  referenceNumber={booking.referenceNumber}
                  employeeLat={employeeLoc?.lat ?? null}
                  employeeLng={employeeLoc?.lng ?? null}
                  employeeName={rider?.name}
                  employeeVehicleType={rider?.vehicleType ?? null}
                  employeePlate={rider?.plateNumber ?? null}
                  pickupLat={pickupCoordsForMap?.lat}
                  pickupLng={pickupCoordsForMap?.lng}
                  dropoffLat={dropoffCoordsForMap?.lat}
                  dropoffLng={dropoffCoordsForMap?.lng}
                  pickupAddress={booking.pickupLocation}
                  dropoffAddress={booking.dropOffLocation}
                  customerName={booking.customer.name}
                  destinationPhase={booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED" ? "dropoff" : "pickup"}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {!hasStarted ? (
              <Card className="border-t-4 border-indigo-500 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-indigo-500" /> Route
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="rounded-lg border bg-gray-50/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground">FROM</p>
                    <p className="font-medium text-xs">{booking.pickupLocation}</p>
                  </div>
                  <div className="flex justify-center text-muted-foreground">↓</div>
                  <div className="rounded-lg border bg-gray-50/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground">TO</p>
                    <p className="font-medium text-xs">{booking.dropOffLocation}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{statusLabel}</Badge>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-t-4 border-green-500 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-green-600" /> Your Rider
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rider ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md overflow-hidden border-2 border-green-200">
                          {rider.profilePic ? (
                            <Image unoptimized width={48} height={48} src={rider.profilePic} alt={rider.name} className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src="/logo.svg" alt="DropnFly logo" className="h-8 w-8 object-contain" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{rider.name}</p>
                          {employeeLoc ? (
                            <Badge variant="success" className="shadow-sm text-[10px]">
                              <div className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> {booking.status === "OUT_FOR_DELIVERY" ? "Delivering" : "On the way"}
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">Starting up GPS</Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {rider.vehicleType && (
                          <div className="rounded-lg border bg-muted/30 p-2">
                            <span className="text-muted-foreground">Vehicle</span>
                            <p className="flex items-center gap-1 font-medium">
                              <VehicleIcon type={rider.vehicleType} /> {rider.vehicleType}
                            </p>
                          </div>
                        )}
                        {rider.plateNumber && (
                          <div className="rounded-lg border bg-muted/30 p-2">
                            <span className="text-muted-foreground">Plate #</span>
                            <p className="font-mono font-bold text-blue-600">{rider.plateNumber}</p>
                          </div>
                        )}
                        <div className="rounded-lg border bg-muted/30 p-2">
                          <span className="text-muted-foreground">Distance</span>
                          <p className="font-bold">{distance ? `${distance.toFixed(1)} km` : "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-2">
                          <span className="text-muted-foreground">ETA</span>
                          <p className="font-bold">{eta || "—"}</p>
                        </div>
                      </div>
                      {rider.lastLocationUpdate && (
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> Updated {new Date(rider.lastLocationUpdate).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading rider details...</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className={`border shadow-md ${chatOpen ? "border-blue-300" : ""}`}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setChatOpen(!chatOpen)}>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-500" /> Chat with {chatMessages.slice().reverse().find((message) => !message.isFromCustomer && message.sender)?.sender?.name || "Support"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {chatMessages.length} msg
                  </Badge>
                </CardTitle>
              </CardHeader>
              {chatOpen && (
                <CardContent className="space-y-3">
                  <div ref={chatBoxRef} onScroll={handleChatScroll} className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2 bg-muted/20">
                    {chatMessages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No messages yet</p>
                    )}
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isFromCustomer ? "justify-start" : "justify-end"}`}>
                        <div className={`rounded-lg px-2.5 py-1.5 max-w-[80%] text-xs ${
                          msg.isFromCustomer ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                        }`}>
                          <p>{msg.message}</p>
                          <p className="text-[9px] opacity-60 mt-0.5">
                            {new Date(msg.createdAt).toLocaleTimeString()}{!msg.isFromCustomer && ` · ${msg.sender?.name || "DropnFly staff"}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div />
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Type a message..."
                      className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                    />
                    <Button size="sm" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                      {chatLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}