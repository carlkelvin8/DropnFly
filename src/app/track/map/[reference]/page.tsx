"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveMap } from "@/components/tracking/LiveMap";
import {
  ChevronLeft,
  Navigation,
  Clock,
  MapPin,
  Map,
  User,
  Bike,
  Car,
  Truck,
  MessageCircle,
  Phone,
  Send,
  Gauge,
} from "lucide-react";

interface TrackingData {
  booking: {
    id: string;
    referenceNumber: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    checkIn: string;
    customer: { name: string; phone: string };
  };
  assignments: {
    user: {
      id: string;
      name: string;
      currentLat: number | null;
      currentLng: number | null;
      lastLocationUpdate: string | null;
      profilePic: string | null;
      vehicleType: string | null;
      plateNumber: string | null;
    };
  }[];
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
  const [data, setData] = useState<TrackingData | null>(null);
  const [employeeLoc, setEmployeeLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; message: string; isFromCustomer: boolean; createdAt: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isRiderView = typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/bookings/${params.reference}`)
      .then((r) => {
        if (!r.ok) throw new Error("Booking not found");
        return r.json();
      })
      .then(async (booking) => {
        const assignmentsRes = await fetch(`/api/bookings/${booking.id}/assignments`);
        if (!assignmentsRes.ok) throw new Error("Failed to load assignments");
        const assignments = await assignmentsRes.json();
        if (cancelled) return;
        setData({ booking, assignments });

        if (assignments.length > 0) {
          const emp = assignments[0].user;
          if (emp.currentLat && emp.currentLng) {
            setEmployeeLoc({ lat: emp.currentLat, lng: emp.currentLng });
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [params.reference]);

  useEffect(() => {
    if (!data?.assignments?.[0]) return;

    const userId = data.assignments[0].user.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tracking/location/${userId}`);
        if (!res.ok) return;
        const loc = await res.json();
        if (loc.currentLat && loc.currentLng) {
          setEmployeeLoc({ lat: loc.currentLat, lng: loc.currentLng });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    if (employeeLoc && data?.booking) {
      const pickupWords = data.booking.pickupLocation.match(/(-?\d+\.?\d*)/g);
      const dropoffWords = data.booking.dropOffLocation.match(/(-?\d+\.?\d*)/g);
      let destLat: number | null = null;
      let destLng: number | null = null;
      if (dropoffWords && dropoffWords.length >= 2) {
        destLat = parseFloat(dropoffWords[0]);
        destLng = parseFloat(dropoffWords[1]);
      } else if (pickupWords && pickupWords.length >= 2) {
        destLat = parseFloat(pickupWords[0]);
        destLng = parseFloat(pickupWords[1]);
      }
      if (destLat && destLng) {
        const d = haversine(employeeLoc.lat, employeeLoc.lng, destLat, destLng);
        setDistance(d);
        const mins = Math.round((d / 30) * 60);
        setEta(mins <= 1 ? "1 min" : `${mins} mins`);
      }
    }
  }, [employeeLoc, data]);

  useEffect(() => {
    if (!chatOpen) return;
    const abort = new AbortController();
    fetch(`/api/public/bookings/${params.reference}/chat`, { signal: abort.signal })
      .then((res) => res.json())
      .then((msgs) => { if (!abort.signal.aborted) setChatMessages(msgs); })
      .catch(() => {});
    return () => abort.abort();
  }, [chatOpen, params.reference]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`/api/public/bookings/${params.reference}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, isFromCustomer: !isRiderView }),
      });
      if (res.ok) {
        const msg = await res.json();
        setChatMessages((prev) => [...prev, msg]);
      }
    } catch {}
    setChatLoading(false);
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading tracking data...</p>
      </div>
    );
  }

  const employee = data.assignments?.[0]?.user;
  const statusLabel = data.booking.status === "OUT_FOR_DELIVERY" ? "Out for Delivery"
    : data.booking.status === "IN_STORAGE" ? "In Storage"
    : data.booking.status.replace("_", " ");

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Dropnfly</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href={isRiderView ? "/dashboard/logistics" : `/track/${params.reference}`} className="flex items-center gap-1">
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
            <p className="font-mono text-sm text-blue-700">{data.booking.referenceNumber}</p>
          </div>
          {eta && (
            <Badge variant="secondary" className="ml-auto text-xs gap-1">
              <Clock className="h-3 w-3" /> ETA: {eta}
            </Badge>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border shadow-lg lg:col-span-2">
            <LiveMap
              referenceNumber={data.booking.referenceNumber}
              employeeLat={employeeLoc?.lat || null}
              employeeLng={employeeLoc?.lng || null}
              employeeName={employee?.name}
              pickupAddress={data.booking.pickupLocation}
              dropoffAddress={data.booking.dropOffLocation}
              customerName={data.booking.customer.name}
              riderView={isRiderView}
            />
          </div>

          <div className="space-y-4">
            {isRiderView ? (
              <Card className="border-t-4 border-blue-500 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-blue-600" /> Customer Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {data.booking.customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{data.booking.customer.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {data.booking.customer.phone}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <span className="text-muted-foreground">Pickup</span>
                      <p className="font-medium">{data.booking.pickupLocation}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <span className="text-muted-foreground">Drop-off</span>
                      <p className="font-medium">{data.booking.dropOffLocation}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <span className="text-muted-foreground">Distance</span>
                      <p className="font-bold">{distance ? `${distance.toFixed(1)} km` : "—"}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <span className="text-muted-foreground">Est. Arrival</span>
                      <p className="font-bold">{eta || "—"}</p>
                    </div>
                  </div>
                  <Badge>{statusLabel}</Badge>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="border-t-4 border-green-500 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-green-600" /> Rider Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {employee ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-base font-bold text-white shadow-md">
                            {employee.profilePic ? (
                              <img src={employee.profilePic} alt={employee.name} className="h-12 w-12 rounded-full object-cover" />
                            ) : (
                              employee.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{employee.name}</p>
                            {employeeLoc ? (
                              <Badge variant="success" className="shadow-sm text-[10px]">
                                <div className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> Moving
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px]">Waiting</Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {employee.vehicleType && (
                            <div className="rounded-lg border bg-muted/30 p-2">
                              <span className="text-muted-foreground">Vehicle</span>
                              <p className="flex items-center gap-1 font-medium">
                                <VehicleIcon type={employee.vehicleType} /> {employee.vehicleType}
                              </p>
                            </div>
                          )}
                          {employee.plateNumber && (
                            <div className="rounded-lg border bg-muted/30 p-2">
                              <span className="text-muted-foreground">Plate #</span>
                              <p className="font-mono font-bold text-blue-600">{employee.plateNumber}</p>
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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {data.booking.pickupLocation}
                        </div>
                        {employee.lastLocationUpdate && (
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Updated {new Date(employee.lastLocationUpdate).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No rider assigned yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-t-4 border-indigo-500 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-indigo-500" /> Route
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-lg border bg-gray-50/50 p-2.5">
                      <p className="text-[10px] text-muted-foreground">FROM</p>
                      <p className="font-medium text-xs">{data.booking.pickupLocation}</p>
                    </div>
                    <div className="flex justify-center text-muted-foreground">↓</div>
                    <div className="rounded-lg border bg-gray-50/50 p-2.5">
                      <p className="text-[10px] text-muted-foreground">TO</p>
                      <p className="font-medium text-xs">{data.booking.dropOffLocation}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{statusLabel}</Badge>
                  </CardContent>
                </Card>
              </>
            )}

            <Card className={`border shadow-md ${chatOpen ? "border-blue-300" : ""}`}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setChatOpen(!chatOpen)}>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-500" /> Chat
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {chatMessages.length} msg
                  </Badge>
                </CardTitle>
              </CardHeader>
              {chatOpen && (
                <CardContent className="space-y-3">
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2 bg-muted/20">
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
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
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
                      <Send className="h-3 w-3" />
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
