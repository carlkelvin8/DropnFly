"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  MapPin,
  Calendar,
  Luggage,
  Home,
  Navigation,
  User,
  MessageCircle,
  X,
  Send,
  Bike,
  Car,
  Truck,
  Camera,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

interface BookingData {
  referenceNumber: string;
  qrCode: string;
  pickupLocation: string;
  dropOffLocation: string;
  checkIn: string;
  checkOut: string | null;
  numberOfBags: number;
  luggageDetails: string | null;
  totalPrice: number;
  status: string;
  customer: { name: string; email: string };
}

interface RiderData {
  id: string;
  name: string;
  profilePic: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
}

interface ChatMessage {
  id: string;
  message: string;
  isFromCustomer: boolean;
  createdAt: string;
  sender?: { name: string; role?: string } | null;
}

const statusConfig: Record<string, { label: string; color: "default" | "secondary" | "success" | "warning" | "destructive" | "outline"; step: number }> = {
  PENDING: { label: "Pending", color: "warning", step: 0 },
  CONFIRMED: { label: "Confirmed", color: "secondary", step: 1 },
  RECEIVED: { label: "Received", color: "default", step: 2 },
  IN_STORAGE: { label: "In Storage", color: "default", step: 3 },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "default", step: 4 },
  DELIVERED: { label: "Delivered", color: "success", step: 5 },
  CANCELLED: { label: "Cancelled", color: "destructive", step: -1 },
};

const steps = [
  { label: "Pending", icon: Package },
  { label: "Confirmed", icon: Package },
  { label: "Received", icon: Package },
  { label: "In Storage", icon: Package },
  { label: "Out for Delivery", icon: Package },
  { label: "Delivered", icon: Package },
];

function VehicleIcon({ type }: { type: string | null }) {
  if (!type) return <Car className="h-5 w-5" />;
  const t = type.toLowerCase();
  if (t.includes("motor") || t.includes("bike")) return <Bike className="h-5 w-5" />;
  if (t.includes("truck") || t.includes("van")) return <Truck className="h-5 w-5" />;
  return <Car className="h-5 w-5" />;
}

export default function TrackResultPage() {
  const params = useParams();
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [rider, setRider] = useState<RiderData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showRiderInfo, setShowRiderInfo] = useState(false);
  const [chatOpen, setChatOpen] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("chat") === "1"
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [scanEvents, setScanEvents] = useState<{ status: string; photo: string | null; note: string | null; scannedAt: string; user: { name: string } | null }[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState<string | null>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatStickToBottomRef = useRef(true);
  const lastChatMessageIdRef = useRef<string | null>(null);
  const verifyFileRef = useRef<HTMLInputElement>(null);
  const [verifyPhoto, setVerifyPhoto] = useState<string | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [scanReload, setScanReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState("lost_baggage");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  async function submitIncidentReport() {
    if (!reportDescription.trim()) return;
    setReportSubmitting(true);
    try {
      const response = await fetch(`/api/public/bookings/${params.reference}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reportType, description: reportDescription }),
      });
      if (!response.ok) throw new Error();
      setReportOpen(false);
      setReportDescription("");
    } finally {
      setReportSubmitting(false);
    }
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const THIRTY_MIN = 30 * 60 * 1000;
  const hasRecentLocation =
    rider?.lastLocationUpdate &&
    now - new Date(rider.lastLocationUpdate).getTime() < THIRTY_MIN;

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/public/bookings/${params.reference}/status`, { signal: abort.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        if (abort.signal.aborted) return;
        setBooking(data.booking);
        setRider(data.rider ?? null);
        setScanEvents(Array.isArray(data.scans) ? data.scans : []);
      })
      .catch(() => { if (!abort.signal.aborted) setNotFound(true); });
    return () => abort.abort();
  }, [params.reference, scanReload]);

  useEffect(() => {
    if (!chatOpen || !params.reference) return;
    let active = true;
    const loadMessages = () => fetch(`/api/public/bookings/${params.reference}/chat`)
      .then((res) => res.json())
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const lastId = data.length ? String(data[data.length - 1].id) : "";
        if (lastId === lastChatMessageIdRef.current) return;
        lastChatMessageIdRef.current = lastId;
        setChatMessages(data);
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
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const msg = await res.json();
        setChatMessages((prev) => [...prev, msg]);
      }
    } catch {
      // silently fail
    }
    setChatLoading(false);
  }

  function handleVerifyPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setVerifyPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleVerifySubmit() {
    if (!verifyPhoto) return;
    setVerifySubmitting(true);
    setVerifyError("");
    try {
      const body: Record<string, unknown> = { photo: verifyPhoto, note: "Passenger drop-off verification" };
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          body.latitude = pos.coords.latitude;
          body.longitude = pos.coords.longitude;
        } catch { /* location optional */ }
      }
      const res = await fetch(`/api/public/bookings/${params.reference}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      setBooking((prev) => (prev ? { ...prev, status: "IN_STORAGE" } : prev));
      setVerifyDone(true);
      setVerifyPhoto(null);
      setScanReload((n) => n + 1);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifySubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-blue-50/50 pt-16">
        <PublicHeader showBackToHome />
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <h1 className="text-2xl font-bold">Booking Not Found</h1>
          <p className="text-muted-foreground">
            No booking found with reference &quot;{params.reference}&quot;
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/track">Try Again</Link>
            </Button>
            <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
              <Link href="/"><Home className="mr-2 h-4 w-4" /> Back to Home</Link>
            </Button>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const config = statusConfig[booking.status] || statusConfig.PENDING;
  const currentStep = config.step;

  return (
    <div className="min-h-screen bg-blue-50/50 pt-16">
      <PublicHeader showBackToHome />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 shadow-lg shadow-blue-200">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-blue-700">
            Luggage Status
          </h1>
          <p className="mt-1 font-mono text-lg tracking-wider text-blue-700">
            {booking.referenceNumber}
          </p>
        </div>

        {/* Rider Section */}
        {rider && (
          <Card className="mb-6 border-t-4 border-green-500 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-green-600" />
                Your Rider
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-lg font-bold text-white shadow-md">
                  {rider.profilePic ? (
                    <Image unoptimized width={56} height={56} src={rider.profilePic} alt={rider.name} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    rider.name.charAt(0)
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{rider.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {rider.vehicleType && (
                      <span className="flex items-center gap-1">
                        <VehicleIcon type={rider.vehicleType} />
                        {rider.vehicleType}
                      </span>
                    )}
                    {rider.plateNumber && (
                      <span className="font-mono text-blue-600">{rider.plateNumber}</span>
                    )}
                  </div>
                </div>
                {rider.profilePic && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setShowRiderInfo(!showRiderInfo)}
                  >
                    View Info
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {showRiderInfo && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 overflow-hidden border-t pt-4"
                  >
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      {rider.profilePic && (
                        <div className="flex justify-center">
                          <Image unoptimized width={96} height={96} src={rider.profilePic} alt={rider.name} className="h-24 w-24 rounded-full border-4 border-green-200 object-cover shadow-md" />
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-lg font-bold">{rider.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {rider.vehicleType && (
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Vehicle</p>
                            <p className="flex items-center gap-1.5 font-medium">
                              <VehicleIcon type={rider.vehicleType} />
                              {rider.vehicleType}
                            </p>
                          </div>
                        )}
                        {rider.plateNumber && (
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Plate Number</p>
                            <p className="font-mono font-medium text-blue-600">{rider.plateNumber}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex gap-2">
                {hasRecentLocation && (
                  <Button asChild className="flex-1 bg-green-600 text-white shadow-lg transition-all hover:bg-green-700 hover:shadow-xl">
                    <Link href={`/track/map/${params.reference}`}>
                      <Navigation className="mr-1.5 h-4 w-4" />
                      View Rider&apos;s Location
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => setChatOpen(!chatOpen)}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  {chatOpen ? "Close Chat" : "Message Support Team"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat Panel */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden"
            >
              <Card className="border-t-4 border-blue-500 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-blue-600" />
                    Chat with {chatMessages.slice().reverse().find((message) => !message.isFromCustomer && message.sender)?.sender?.name || "DropnFly Support Team"}
                  </CardTitle>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </CardHeader>
                <CardContent>
                  <div ref={chatBoxRef} onScroll={handleChatScroll} className="mb-3 max-h-60 overflow-y-auto space-y-3 rounded-lg border bg-muted/20 p-3">
                    {chatMessages.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No messages yet. Start a conversation with your rider.
                      </p>
                    )}
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isFromCustomer ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                            msg.isFromCustomer
                              ? "rounded-tr-none bg-orange-500 text-white"
                              : "rounded-tl-none bg-muted"
                          }`}
                        >
                          {msg.message}
                          {!msg.isFromCustomer && (
                            <p className="mt-1 text-[10px] opacity-70">{msg.sender?.name || "DropnFly staff"}{msg.sender?.role ? ` · ${msg.sender.role.toLowerCase()}` : ""}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendChat();
                        }
                      }}
                      placeholder="Type your message..."
                      className="flex-1 rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-background"
                    />
                    <button
                      onClick={sendChat}
                      disabled={!chatInput.trim() || chatLoading}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition-all hover:bg-orange-600 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {booking.status === "RECEIVED" && !verifyDone && (
          <Card className="mb-6 border-t-4 border-purple-500 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Camera className="h-4 w-4 text-purple-600" />
                Verify Your Drop-off
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Your luggage has been received by our staff. Confirm the handover by taking a photo to move
                your booking to <strong className="text-purple-700">In Storage</strong>.
              </p>
              {verifyPhoto ? (
                <div className="relative overflow-hidden rounded-xl border">
                  <Image unoptimized width={800} height={320} src={verifyPhoto} alt="Drop-off verification" className="h-40 w-full object-cover" />
                  <button
                    onClick={() => setVerifyPhoto(null)}
                    className="absolute top-2 right-2 rounded-full bg-red-500 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => verifyFileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-6 transition-colors hover:border-purple-500/50 hover:bg-purple-50/50"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Take a photo of your handed-over luggage</p>
                </button>
              )}
              <input
                ref={verifyFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleVerifyPhoto}
                className="hidden"
              />
              {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
              <Button
                className="w-full bg-orange-500 text-white shadow-lg hover:bg-orange-600"
                onClick={handleVerifySubmit}
                disabled={!verifyPhoto || verifySubmitting}
              >
                {verifySubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Drop-off</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {verifyDone && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">
                Drop-off verified — your luggage is now <strong>In Storage</strong>.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-t-4 border-blue-500 shadow-lg">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 text-center">
              <Badge variant={config.color} className="px-4 py-1.5 text-sm shadow-sm">
                {config.label}
              </Badge>
            </div>

            {currentStep >= 0 && (
              <div className="relative">
                <div className="absolute left-[23px] top-2 h-[calc(100%-16px)] w-0.5 bg-gradient-to-b from-blue-500 to-border" />
                <div className="space-y-0">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i <= currentStep;
                    const isCurrent = i === currentStep;
                    const statusValue = ["PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"][i];
                    const scan = scanEvents.find((s) => s.status === statusValue);

                    return (
                      <div key={step.label} className="relative flex items-start gap-4 pb-8 last:pb-0">
                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm transition-all ${
                              isActive
                                ? "border-blue-600 bg-orange-500 text-white shadow-md shadow-blue-200"
                                : "border-border bg-card text-muted-foreground/60"
                            } ${isCurrent ? "ring-4 ring-blue-200" : ""}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="flex flex-col justify-center pt-2.5 min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold ${
                              isActive ? "text-blue-800" : "text-muted-foreground/60"
                            }`}
                          >
                            {step.label}
                            {isCurrent && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                Current
                              </span>
                            )}
                          </p>
                          {isActive && !isCurrent && (
                            <p className="text-xs text-blue-500">Completed</p>
                          )}
                          {scan && (
                            <div className="mt-1 space-y-1">
                              {scan.scannedAt && (
                                <p className="text-[10px] text-muted-foreground/60">
                                  {new Date(scan.scannedAt).toLocaleString("en-PH")}
                                  {scan.user && ` · ${scan.user.name}`}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {scan.photo && (
                                  <button onClick={() => setShowPhotoModal(scan.photo!)}>
                                    <Image unoptimized width={80} height={80}
                                      src={scan.photo}
                                      alt="Proof"
                                      className="h-10 w-10 rounded border object-cover hover:opacity-80 transition-opacity"
                                    />
                                  </button>
                                )}
                                {scan.note && (
                                  <p className="text-[10px] text-muted-foreground italic w-full">{scan.note}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep < 0 && (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm font-medium text-red-600">This booking was cancelled.</p>
                {scanEvents.filter((event) => event.status === "CANCELLED").map((event, index) => (
                  <div key={`${event.scannedAt}-${index}`} className="rounded-lg border border-red-200 bg-white p-3 text-left">
                    <p className="text-xs font-semibold text-red-700">Cancellation proof</p>
                    {event.note && <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>}
                    {event.photo && <button className="mt-2" onClick={() => setShowPhotoModal(event.photo)}><Image unoptimized width={120} height={80} src={event.photo} alt="Cancellation proof" className="h-20 w-28 rounded object-cover" /></button>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-indigo-500 shadow-lg">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <MapPin className="mt-0.5 h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-muted-foreground">Pickup Location</p>
                  <p className="font-medium">{booking.pickupLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <MapPin className="mt-0.5 h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-muted-foreground">Drop-off Location</p>
                  <p className="font-medium">{booking.dropOffLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <Calendar className="mt-0.5 h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-muted-foreground">Scheduled Date</p>
                  <p className="font-medium">
                    {new Date(booking.checkIn).toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <Luggage className="mt-0.5 h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-muted-foreground">Number of Luggage</p>
                  <p className="font-medium">{booking.numberOfBags}</p>
                </div>
              </div>
            </div>

            {(() => {
              let items: Array<{ type?: string; qty?: number; price?: number; services?: string[] }> = [];
              try {
                if (booking.luggageDetails) items = JSON.parse(booking.luggageDetails);
              } catch {}
              if (items.length === 0 && !booking.luggageDetails) return null;
              const luggageItems = items.filter(
                (i): i is { type: string; qty: number; price: number } =>
                  !!i && typeof i.type === "string" && typeof i.qty === "number"
              );
              const services = items.flatMap((i) =>
                Array.isArray(i?.services) ? i.services : []
              );
              return (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm text-muted-foreground">Luggage Details</p>
                  {luggageItems.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {luggageItems.map((item, i) => (
                        <p key={i} className="text-sm">
                          {item.type}: <strong>{item.qty}x</strong> (&#x20B1;{(item.price * item.qty).toFixed(2)})
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm">{booking.luggageDetails}</p>
                  )}
                  {services.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs font-medium text-purple-700">Additional Services</p>
                      {services.map((svc, i) => (
                        <p key={i} className="text-sm text-purple-700">• {svc}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-6 flex flex-wrap justify-center gap-3 border-t pt-4">
              {rider && (
                <Button asChild className="bg-orange-500 text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl">
                  <Link href={`/track/map/${params.reference}`}>
                    <Navigation className="mr-2 h-4 w-4" />
                    Live Map
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                <Link href="/book">Book Another Pickup</Link>
              </Button>
              <Button type="button" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setChatOpen(!chatOpen)}>
                <MessageCircle className="mr-2 h-4 w-4" />
                {chatOpen ? "Close Chat" : "Message Support Team"}
              </Button>
              <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setReportOpen(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" /> File Incident Report
              </Button>
              <Button asChild variant="outline" className="border-border text-foreground hover:bg-muted">
                <Link href="/"><Home className="mr-2 h-4 w-4" /> Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <PublicFooter />

      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowPhotoModal(null)}>
          <div className="relative max-w-lg max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image unoptimized width={1000} height={1000} src={showPhotoModal} alt="Photo proof" className="max-h-[80vh] w-auto rounded-lg shadow-2xl" />
            <button onClick={() => setShowPhotoModal(null)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}>
          <div className="w-full max-w-md space-y-4 rounded-xl bg-background p-6 shadow-2xl">
            <div><h2 className="font-semibold">File an incident report</h2><p className="text-sm text-muted-foreground">This will be sent directly to DropnFly staff for review.</p></div>
            <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="lost_baggage">Lost baggage</option><option value="damaged_baggage">Damaged baggage</option><option value="service_complaint">Service complaint</option><option value="other">Other</option>
            </select>
            <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={5} maxLength={4000} placeholder="Describe what happened..." className="w-full rounded-md border bg-background p-3 text-sm" />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button onClick={submitIncidentReport} disabled={reportSubmitting || !reportDescription.trim()}>{reportSubmitting ? "Submitting..." : "Submit Report"}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
