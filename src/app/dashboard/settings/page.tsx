"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Luggage,
  PiggyBank,
  Globe,
  Warehouse,
  Bell,
  Save,
  RotateCcw,
  QrCode,
  ToggleLeft,
  Footprints,
  Calendar,
  Wrench,
  Mail,
  Truck,
  Plus,
  Trash2,
  Bike,
  Car,
  FileText,
} from "lucide-react";

const SETTING_DEFAULTS: Record<string, string> = {
  luggage_extra_small_price: "50",
  luggage_small_price: "150",
  luggage_standard_price: "175",
  luggage_large_price: "250",
  excess_bag_fee: "100",
  excess_bag_threshold: "3",
  pickup_fee: "0",
  delivery_fee: "0",
  currency: "PHP",
  min_dp_percentage: "50",
  max_simultaneous_bags: "50",
  max_concurrent_pickups: "3",
  max_concurrent_deliveries: "3",
  pickup_slot_duration: "60",
  delivery_slot_duration: "60",
  operating_start: "00:00",
  operating_end: "23:59",
  max_bags_per_booking: "10",
  email_notifications_enabled: "true",
  rider_assignment_email: "true",
  booking_confirmation_email: "true",
  qr_scan_notification: "true",
  smtp_host: "",
  smtp_port: "587",
  smtp_from: "noreply@dropnfly.ph",
  qr_code_prefix: "DNF",
  qr_image_size: "300",
  online_booking_enabled: "true",
  walk_in_mode_enabled: "false",
  customer_reviews_enabled: "true",
  discount_codes_enabled: "true",
  footer_phone: "+63 (2) 1234 5678",
  footer_email: "hello@dropnfly.ph",
  footer_facebook: "https://facebook.com/dropnfly",
  footer_instagram: "https://instagram.com/dropnfly",
  footer_twitter: "https://twitter.com/dropnfly",
  tx_prefix: "DNF",
  store_operating_days: "0,1,2,3,4,5,6",
  store_operating_start: "00:00",
  store_operating_end: "23:59",
  max_advance_booking_days: "30",
  min_storage_days: "1",
  max_storage_days: "30",
  free_cancellation_window_hours: "24",
  maintenance_mode_enabled: "false",
  maintenance_message: "We are currently undergoing scheduled maintenance. Please check back shortly.",
  email_sender_name: "Dropnfly",
  email_reply_to: "support@dropnfly.ph",
  email_company_name: "Dropnfly Logistics Inc.",
  fleet_data: "[]",
  auto_flag_hours_no_scan: "48",
  auto_flag_days_in_storage: "14",
  auto_flag_hours_overdue_return: "24",
  terms_and_conditions: `1. Service Description\nDropnfly provides luggage storage and delivery services at NAIA Terminals 1-4. By using our service, you agree to these terms.\n\n2. Booking & Payment\nA minimum of 50% down payment is required to reserve a slot. The remaining balance is collectible upon pickup or delivery.\n\n3. Prohibited Items\nCustomers must not include illegal items, hazardous materials, perishables, firearms, or valuables (cash, jewelry, electronics) in stored luggage. Dropnfly is not liable for prohibited or valuable items.\n\n4. Storage Duration\nLuggage is stored from the scheduled pickup time until the scheduled delivery time. Extended storage may incur additional fees.\n\n5. Liability\nDropnfly's liability is limited to the declared value of the stored items. We recommend against storing irreplaceable or high-value items.\n\n6. Cancellation\nCancellation policies vary. Contact customer support for assistance with cancellations and refunds.\n\n7. Rider Assignment\nDropnfly assigns riders for pickup and delivery. Rider details (name, photo, vehicle, plate number) are shared with the customer.`,
  privacy_policy: `1. Information We Collect\nWe collect personal information (name, email, phone, country/city of origin) and booking details (pickup/delivery locations, dates, times, luggage information) to provide our services.\n\n2. How We Use Your Information\nYour information is used to process bookings, assign riders, send confirmations, provide tracking, and improve our services.\n\n3. Data Sharing\nWe share necessary information with our riders (name, pickup location) for service delivery. We do not sell your personal data to third parties.\n\n4. Location Data\nWe may collect location data to facilitate rider pickup. This data is used only for service purposes and not stored longer than necessary.\n\n5. Data Security\nWe implement reasonable security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.\n\n6. Contact\nFor privacy-related inquiries, contact our support team.`,
};

const BAG_TYPES = [
  { key: "luggage_extra_small_price", name: "Extra Small", desc: "Backpack, laptop bag, handbag", dims: "45 x 35 x 20 cm", color: "bg-emerald-100 text-emerald-700" },
  { key: "luggage_small_price", name: "Small", desc: "Duffle bag, carry-on suitcase", dims: "55 x 40 x 20 cm", color: "bg-blue-100 text-blue-700" },
  { key: "luggage_standard_price", name: "Standard", desc: "Medium suitcase, check-in bag", dims: "65 x 45 x 25 cm", color: "bg-violet-100 text-violet-700" },
  { key: "luggage_large_price", name: "Large", desc: "Large suitcase, oversized bag", dims: "75 x 50 x 30 cm", color: "bg-amber-100 text-amber-700" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface FleetVehicle {
  id: string;
  type: string;
  count: number;
  icon: "bike" | "car" | "truck";
}

const TABS = [
  { id: "rates", label: "Rates", icon: Luggage, color: "text-emerald-500" },
  { id: "fees", label: "Fees", icon: PiggyBank, color: "text-amber-500" },
  { id: "capacity", label: "Capacity", icon: Warehouse, color: "text-blue-500" },
  { id: "finance", label: "Finance", icon: Globe, color: "text-violet-500" },
  { id: "notifications", label: "Notifications", icon: Bell, color: "text-rose-500" },
  { id: "booking", label: "Booking Rules", icon: Calendar, color: "text-cyan-500" },
  { id: "features", label: "Features", icon: ToggleLeft, color: "text-orange-500" },
  { id: "footer", label: "Footer", icon: Footprints, color: "text-indigo-500" },
  { id: "qr", label: "QR & Codes", icon: QrCode, color: "text-teal-500" },
  { id: "fleet", label: "Fleet", icon: Truck, color: "text-yellow-600" },
  { id: "email", label: "Email Sender", icon: Mail, color: "text-sky-500" },
  { id: "terms", label: "Terms & Privacy", icon: FileText, color: "text-blue-500" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, color: "text-red-500" },
];

const SECTION_KEYS: Record<string, string[]> = {
  rates: ["luggage_extra_small_price", "luggage_small_price", "luggage_standard_price", "luggage_large_price", "excess_bag_fee", "excess_bag_threshold"],
  fees: ["pickup_fee", "delivery_fee"],
  capacity: ["max_simultaneous_bags", "max_bags_per_booking", "max_concurrent_pickups", "max_concurrent_deliveries", "pickup_slot_duration", "delivery_slot_duration", "operating_start", "operating_end"],
  finance: ["currency", "min_dp_percentage"],
  notifications: ["email_notifications_enabled", "rider_assignment_email", "booking_confirmation_email", "qr_scan_notification", "smtp_host", "smtp_port", "smtp_from"],
  booking: ["tx_prefix", "max_advance_booking_days", "min_storage_days", "max_storage_days", "free_cancellation_window_hours", "store_operating_days", "auto_flag_hours_no_scan", "auto_flag_days_in_storage", "auto_flag_hours_overdue_return"],
  features: ["online_booking_enabled", "walk_in_mode_enabled", "customer_reviews_enabled", "discount_codes_enabled"],
  footer: ["footer_phone", "footer_email", "footer_facebook", "footer_instagram", "footer_twitter", "store_operating_start", "store_operating_end"],
  qr: ["qr_code_prefix", "qr_image_size"],
  fleet: ["fleet_data", "max_concurrent_pickups", "max_concurrent_deliveries"],
  email: ["email_sender_name", "email_reply_to", "email_company_name"],
  terms: ["terms_and_conditions", "privacy_policy"],
  maintenance: ["maintenance_mode_enabled", "maintenance_message"],
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rates");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        setSettings({ ...SETTING_DEFAULTS, ...data });
        setDirtyKeys(new Set());
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  }

  function getSectionDirty(section: string): string[] {
    return (SECTION_KEYS[section] || []).filter((k) => dirtyKeys.has(k));
  }

  async function persistSettings(keys: string[]) {
    if (keys.length === 0) return;
    const payload: Record<string, string> = {};
    for (const k of keys) payload[k] = settings[k];
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok) throw new Error(result?.error || "Failed to save settings");
    setSettings((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = result?.[k] ?? prev[k];
      return next;
    });
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
    return result;
  }

  async function handleSaveSection(section: string) {
    const keys = getSectionDirty(section);
    if (keys.length === 0) {
      toast.info("No changes to save in this section");
      return;
    }
    setSavingSection(section);
    try {
      await persistSettings(keys);
      toast.success("Section saved and applied successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingSection(null);
    }
  }

  async function handleSaveAll() {
    const keys = Array.from(dirtyKeys);
    if (keys.length === 0) {
      toast.info("No unsaved changes");
      return;
    }
    setSavingAll(true);
    try {
      await persistSettings(keys);
      toast.success("All unsaved changes saved and applied successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingAll(false);
    }
  }

  function handleResetSection(section: string) {
    const next = { ...settings };
    for (const k of SECTION_KEYS[section] || []) next[k] = SETTING_DEFAULTS[k] ?? "";
    setSettings(next);
    setDirtyKeys((prev) => {
      const updated = new Set(prev);
      for (const k of SECTION_KEYS[section] || []) updated.add(k);
      return updated;
    });
    toast.info("Section restored to defaults. Click Save to apply.");
  }

  function handleResetAll() {
    setSettings({ ...SETTING_DEFAULTS });
    setDirtyKeys(new Set(Object.keys(SETTING_DEFAULTS)));
    toast.info("Defaults restored. Save to apply.");
  }

  function toggleDay(day: string) {
    const current = (settings.store_operating_days || "").split(",").filter(Boolean);
    const idx = current.indexOf(day);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(day);
    current.sort((a, b) => parseInt(a) - parseInt(b));
    handleChange("store_operating_days", current.join(","));
  }

  function getFleet(): FleetVehicle[] {
    try { return JSON.parse(settings.fleet_data || "[]"); } catch { return []; }
  }

  function setFleet(fleet: FleetVehicle[]) {
    const totalVehicles = fleet.reduce((sum, vehicle) => sum + Math.max(0, vehicle.count), 0);
    setSettings((prev) => ({
      ...prev,
      fleet_data: JSON.stringify(fleet),
      max_concurrent_pickups: String(Math.max(1, totalVehicles)),
      max_concurrent_deliveries: String(Math.max(1, totalVehicles)),
    }));
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.add("fleet_data");
      next.add("max_concurrent_pickups");
      next.add("max_concurrent_deliveries");
      return next;
    });
  }

  function addVehicle() {
    const fleet = getFleet();
    const id = `v_${Date.now()}`;
    fleet.push({ id, type: "Motorcycle", count: 1, icon: "bike" });
    setFleet(fleet);
  }

  function updateVehicle(id: string, field: keyof FleetVehicle, value: string | number) {
    const fleet = getFleet().map((v) => v.id === id ? { ...v, [field]: value } : v);
    setFleet(fleet);
  }

  function removeVehicle(id: string) {
    setFleet(getFleet().filter((v) => v.id !== id));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (<Skeleton key={i} className="h-9 w-full" />))}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Management</h1>
          <p className="text-sm text-muted-foreground">
            Configure rates, fees, capacity, features, and system preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetAll}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={savingAll || dirtyKeys.size === 0}>
            <Save className="mr-1 h-3.5 w-3.5" /> {savingAll ? "Saving..." : `Save All Unsaved${dirtyKeys.size > 0 ? ` (${dirtyKeys.size})` : ""}`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const unsaved = getSectionDirty(tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                isActive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? tab.color : ""}`} />
              {tab.label}
              {unsaved > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-orange-500"
                  title={`${unsaved} unsaved change${unsaved > 1 ? "s" : ""}`}
                  aria-label={`${unsaved} unsaved change${unsaved > 1 ? "s" : ""}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "rates" && (
        <Card className="border-t-2 border-t-emerald-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Luggage className="h-4 w-4 text-emerald-500" /> Luggage Storage Rates
            </CardTitle>
            <CardDescription>Set the daily storage price per bag size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {BAG_TYPES.map((bag) => (
                <div key={bag.key} className={`rounded-lg border p-4 ${bag.color} border-dashed`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{bag.name}</p>
                      <p className="text-xs text-muted-foreground">{bag.desc}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">{bag.dims}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">P</span>
                      <Input type="number" min="0" className="h-8 w-24 text-right font-mono"
                        value={settings[bag.key] || "0"}
                        onChange={(e) => handleChange(bag.key, e.target.value)} />
                      <span className="text-xs text-muted-foreground">/day</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="excess_bag_fee">Excess Bag Fee (P)</Label>
                <div className="flex items-center gap-2">
                  <Input id="excess_bag_fee" type="number" min="0" className="w-28 font-mono"
                    value={settings.excess_bag_fee || "100"}
                    onChange={(e) => handleChange("excess_bag_fee", e.target.value)} />
                  <span className="text-xs text-muted-foreground">per excess bag</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="excess_bag_threshold">Excess Bag Threshold</Label>
                <div className="flex items-center gap-2">
                  <Input id="excess_bag_threshold" type="number" min="1" className="w-28 font-mono"
                    value={settings.excess_bag_threshold || "3"}
                    onChange={(e) => handleChange("excess_bag_threshold", e.target.value)} />
                  <span className="text-xs text-muted-foreground">bags before fee applies</span>
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("rates").length}
              saving={savingSection === "rates"}
              onReset={() => handleResetSection("rates")}
              onSave={() => handleSaveSection("rates")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "fees" && (
        <Card className="border-t-2 border-t-amber-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4 text-amber-500" /> Service Fees
            </CardTitle>
            <CardDescription>Configure pick-up and delivery service charges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pickup_fee">Pick-up Service Fee (P)</Label>
                <p className="text-[10px] text-muted-foreground">Charged when rider picks up from customer</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">P</span>
                  <Input id="pickup_fee" type="number" min="0" className="w-32 font-mono"
                    value={settings.pickup_fee || "0"}
                    onChange={(e) => handleChange("pickup_fee", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delivery_fee">Delivery Service Fee (P)</Label>
                <p className="text-[10px] text-muted-foreground">Charged when rider delivers to customer</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">P</span>
                  <Input id="delivery_fee" type="number" min="0" className="w-32 font-mono"
                    value={settings.delivery_fee || "0"}
                    onChange={(e) => handleChange("delivery_fee", e.target.value)} />
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("fees").length}
              saving={savingSection === "fees"}
              onReset={() => handleResetSection("fees")}
              onSave={() => handleSaveSection("fees")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "capacity" && (
        <Card className="border-t-2 border-t-blue-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Warehouse className="h-4 w-4 text-blue-500" /> Capacity & Time Slots
            </CardTitle>
            <CardDescription>Manage storage capacity, fleet size, and operating hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="max_simultaneous_bags">Max Simultaneous Bags in Storage</Label>
                <Input id="max_simultaneous_bags" type="number" min="1" className="w-28 font-mono"
                  value={settings.max_simultaneous_bags || "50"}
                  onChange={(e) => handleChange("max_simultaneous_bags", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Total bag capacity across all terminals</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_bags_per_booking">Max Bags Per Booking</Label>
                <Input id="max_bags_per_booking" type="number" min="1" className="w-28 font-mono"
                  value={settings.max_bags_per_booking || "10"}
                  onChange={(e) => handleChange("max_bags_per_booking", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_concurrent_pickups">Max Simultaneous Pickups</Label>
                <Input id="max_concurrent_pickups" type="number" min="1" className="w-28 font-mono"
                  value={settings.max_concurrent_pickups || "3"}
                  onChange={(e) => handleChange("max_concurrent_pickups", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Vehicles available for pickup at same time</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_concurrent_deliveries">Max Simultaneous Deliveries</Label>
                <Input id="max_concurrent_deliveries" type="number" min="1" className="w-28 font-mono"
                  value={settings.max_concurrent_deliveries || "3"}
                  onChange={(e) => handleChange("max_concurrent_deliveries", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Vehicles available for delivery at same time</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup_slot_duration">Pickup Slot Duration (min)</Label>
                <Input id="pickup_slot_duration" type="number" min="15" step="15" className="w-28 font-mono"
                  value={settings.pickup_slot_duration || "60"}
                  onChange={(e) => handleChange("pickup_slot_duration", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delivery_slot_duration">Delivery Slot Duration (min)</Label>
                <Input id="delivery_slot_duration" type="number" min="15" step="15" className="w-28 font-mono"
                  value={settings.delivery_slot_duration || "60"}
                  onChange={(e) => handleChange("delivery_slot_duration", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="operating_start">Operating Start Time</Label>
                <Input id="operating_start" type="time" className="w-32"
                  value={settings.operating_start || "00:00"}
                  onChange={(e) => handleChange("operating_start", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="operating_end">Operating End Time</Label>
                <Input id="operating_end" type="time" className="w-32"
                  value={settings.operating_end || "23:59"}
                  onChange={(e) => handleChange("operating_end", e.target.value)} />
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("capacity").length}
              saving={savingSection === "capacity"}
              onReset={() => handleResetSection("capacity")}
              onSave={() => handleSaveSection("capacity")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "finance" && (
        <Card className="border-t-2 border-t-violet-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-violet-500" /> Currency & Payment
            </CardTitle>
            <CardDescription>Configure currency and minimum down payment requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select id="currency" value={settings.currency || "PHP"}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  options={[
                    { value: "PHP", label: "PHP - Philippine Peso" },
                  ]} className="w-full" />
                <p className="text-[10px] text-muted-foreground">Prices and PayMongo settlements currently operate in Philippine pesos.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min_dp_percentage">Minimum Down Payment (%)</Label>
                <div className="flex items-center gap-2">
                  <Input id="min_dp_percentage" type="number" min="0" max="100" step="5" className="w-28 font-mono"
                    value={settings.min_dp_percentage || "50"}
                    onChange={(e) => handleChange("min_dp_percentage", e.target.value)} />
                  <span className="text-xs text-muted-foreground">% of total to reserve a booking</span>
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("finance").length}
              saving={savingSection === "finance"}
              onReset={() => handleResetSection("finance")}
              onSave={() => handleSaveSection("finance")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card className="border-t-2 border-t-rose-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-rose-500" /> Email Notifications
            </CardTitle>
            <CardDescription>Control which email notifications are sent to customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Enable Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Master toggle for all notification emails</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={settings.email_notifications_enabled === "true" ? "success" : "secondary"} className="text-[10px]">
                      {settings.email_notifications_enabled === "true" ? "Active" : "Disabled"}
                    </Badge>
                    <select value={settings.email_notifications_enabled || "true"}
                      onChange={(e) => handleChange("email_notifications_enabled", e.target.value)}
                      className="h-7 w-16 rounded-md border px-1 text-xs">
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { key: "rider_assignment_email", label: "Rider Assigned", desc: "Email customer when a rider is assigned" },
                  { key: "booking_confirmation_email", label: "Booking Confirmed", desc: "Email booking confirmation on creation" },
                  { key: "qr_scan_notification", label: "QR Scan Update", desc: "Notify on status updates via QR scan" },
                ].map((item) => (
                  <div key={item.key} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor={item.key} className="text-xs font-medium">{item.label}</Label>
                      <select id={item.key} value={settings[item.key] || "true"}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        className="h-6 w-14 rounded-md border px-1 text-[10px]">
                        <option value="true">On</option>
                        <option value="false">Off</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 border-t pt-4">
              <h4 className="mb-3 text-sm font-medium">SMTP Configuration</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input id="smtp_host" value={settings.smtp_host || ""}
                    onChange={(e) => handleChange("smtp_host", e.target.value)}
                    placeholder="smtp.example.com" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input id="smtp_port" type="number" value={settings.smtp_port || "587"}
                    onChange={(e) => handleChange("smtp_port", e.target.value)}
                    placeholder="587" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_from">From Address</Label>
                  <Input id="smtp_from" value={settings.smtp_from || ""}
                    onChange={(e) => handleChange("smtp_from", e.target.value)}
                    placeholder="noreply@dropnfly.ph" className="font-mono text-xs" />
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("notifications").length}
              saving={savingSection === "notifications"}
              onReset={() => handleResetSection("notifications")}
              onSave={() => handleSaveSection("notifications")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "booking" && (
        <Card className="border-t-2 border-t-cyan-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-cyan-500" /> Booking Rules
            </CardTitle>
            <CardDescription>Set booking limits, storage duration constraints, and cancellation policies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tx_prefix">Transaction Code Prefix</Label>
                <div className="flex items-center gap-2">
                  <Input id="tx_prefix" className="w-24 font-mono uppercase"
                    value={settings.tx_prefix || "DNF"}
                    onChange={(e) => handleChange("tx_prefix", e.target.value.toUpperCase())} />
                  <span className="text-xs text-muted-foreground">Used in booking reference numbers (e.g. DNF-XXXXXX)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_advance_booking_days">Max Advance Booking (days)</Label>
                <Input id="max_advance_booking_days" type="number" min="1" max="365" className="w-28 font-mono"
                  value={settings.max_advance_booking_days || "30"}
                  onChange={(e) => handleChange("max_advance_booking_days", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">How far ahead customers can book</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min_storage_days">Minimum Storage Days</Label>
                <Input id="min_storage_days" type="number" min="0" className="w-28 font-mono"
                  value={settings.min_storage_days || "1"}
                  onChange={(e) => handleChange("min_storage_days", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Minimum duration a booking must be stored</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_storage_days">Maximum Storage Days</Label>
                <Input id="max_storage_days" type="number" min="1" max="365" className="w-28 font-mono"
                  value={settings.max_storage_days || "30"}
                  onChange={(e) => handleChange("max_storage_days", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Maximum duration a booking can be stored</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="free_cancellation_window_hours">Free Cancellation Window (hours)</Label>
                <Input id="free_cancellation_window_hours" type="number" min="0" className="w-28 font-mono"
                  value={settings.free_cancellation_window_hours || "24"}
                  onChange={(e) => handleChange("free_cancellation_window_hours", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Self-service cancellation closes this many hours before pickup</p>
              </div>
              <div className="space-y-1.5">
                <Label>Store Operating Days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day, i) => {
                    const active = (settings.store_operating_days || "").split(",").includes(String(i));
                    return (
                      <button key={i} type="button" onClick={() => toggleDay(String(i))} aria-label={`Toggle ${day}`}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                          active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">Shown in customer page footer</p>
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <h4 className="mb-3 text-sm font-medium">Auto-Flagging for Lost Baggage Detection</h4>
              <p className="mb-3 text-xs text-muted-foreground">System automatically flags luggage items when these thresholds are exceeded</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auto_flag_hours_no_scan">No Scan After Pickup (hours)</Label>
                  <Input id="auto_flag_hours_no_scan" type="number" min="1" className="w-28 font-mono"
                    value={settings.auto_flag_hours_no_scan || "48"}
                    onChange={(e) => handleChange("auto_flag_hours_no_scan", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Flag if no QR scan after pickup</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auto_flag_days_in_storage">In Storage Without Activity (days)</Label>
                  <Input id="auto_flag_days_in_storage" type="number" min="1" className="w-28 font-mono"
                    value={settings.auto_flag_days_in_storage || "14"}
                    onChange={(e) => handleChange("auto_flag_days_in_storage", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Flag if no activity while in storage</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auto_flag_hours_overdue_return">Overdue Return (hours)</Label>
                  <Input id="auto_flag_hours_overdue_return" type="number" min="1" className="w-28 font-mono"
                    value={settings.auto_flag_hours_overdue_return || "24"}
                    onChange={(e) => handleChange("auto_flag_hours_overdue_return", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Flag if return exceeds check-out time</p>
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("booking").length}
              saving={savingSection === "booking"}
              onReset={() => handleResetSection("booking")}
              onSave={() => handleSaveSection("booking")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "features" && (
        <Card className="border-t-2 border-t-orange-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ToggleLeft className="h-4 w-4 text-orange-500" /> Customer Features
            </CardTitle>
            <CardDescription>Enable or disable customer-facing features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "online_booking_enabled", label: "Online Booking", desc: "Customers can book via the website" },
                { key: "walk_in_mode_enabled", label: "Walk-in Mode", desc: "Accept walk-in customers without online booking" },
                { key: "customer_reviews_enabled", label: "Customer Reviews", desc: "Allow customers to leave reviews after delivery" },
                { key: "discount_codes_enabled", label: "Discount Codes", desc: "Allow promo code usage during checkout" },
              ].map((item) => (
                <div key={item.key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <select value={settings[item.key] || "true"}
                      onChange={(e) => handleChange(item.key, e.target.value)}
                      className="h-7 w-16 rounded-md border px-1 text-xs">
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("features").length}
              saving={savingSection === "features"}
              onReset={() => handleResetSection("features")}
              onSave={() => handleSaveSection("features")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "footer" && (
        <Card className="border-t-2 border-t-indigo-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Footprints className="h-4 w-4 text-indigo-500" /> Footer Configuration
            </CardTitle>
            <CardDescription>Contact details and social links shown in the footer of all customer-facing pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="footer_phone">Phone Number</Label>
                <Input id="footer_phone" value={settings.footer_phone || ""}
                  onChange={(e) => handleChange("footer_phone", e.target.value)}
                  placeholder="+63 (2) 1234 5678" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="footer_email">Email Address</Label>
                <Input id="footer_email" type="email" value={settings.footer_email || ""}
                  onChange={(e) => handleChange("footer_email", e.target.value)}
                  placeholder="hello@dropnfly.ph" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="footer_facebook">Facebook URL</Label>
                <Input id="footer_facebook" value={settings.footer_facebook || ""}
                  onChange={(e) => handleChange("footer_facebook", e.target.value)}
                  placeholder="https://facebook.com/dropnfly" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="footer_instagram">Instagram URL</Label>
                <Input id="footer_instagram" value={settings.footer_instagram || ""}
                  onChange={(e) => handleChange("footer_instagram", e.target.value)}
                  placeholder="https://instagram.com/dropnfly" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="footer_twitter">Twitter / X URL</Label>
                <Input id="footer_twitter" value={settings.footer_twitter || ""}
                  onChange={(e) => handleChange("footer_twitter", e.target.value)}
                  placeholder="https://twitter.com/dropnfly" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>Store Hours (shown in footer)</Label>
                <div className="flex items-center gap-2">
                  <Input type="time" className="w-28"
                    value={settings.store_operating_start || "00:00"}
                    onChange={(e) => handleChange("store_operating_start", e.target.value)} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="time" className="w-28"
                    value={settings.store_operating_end || "23:59"}
                    onChange={(e) => handleChange("store_operating_end", e.target.value)} />
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("footer").length}
              saving={savingSection === "footer"}
              onReset={() => handleResetSection("footer")}
              onSave={() => handleSaveSection("footer")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "qr" && (
        <Card className="border-t-2 border-t-teal-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4 text-teal-500" /> QR Tracking Configuration
            </CardTitle>
            <CardDescription>Configure QR code generation for tracking and confirmation emails</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qr_code_prefix">QR Code Prefix</Label>
                <div className="flex items-center gap-2">
                  <Input id="qr_code_prefix" className="w-28 font-mono uppercase"
                    value={settings.qr_code_prefix || "DNF"}
                    onChange={(e) => handleChange("qr_code_prefix", e.target.value.toUpperCase())} />
                  <span className="text-xs text-muted-foreground">Prepended to QR code data (e.g. DNF-REF123)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr_image_size">QR Image Size (px)</Label>
                <div className="flex items-center gap-2">
                  <Input id="qr_image_size" type="number" min="100" max="1000" step="50" className="w-28 font-mono"
                    value={settings.qr_image_size || "300"}
                    onChange={(e) => handleChange("qr_image_size", e.target.value)} />
                  <span className="text-xs text-muted-foreground">px &times; px (used in confirmation emails)</span>
                </div>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("qr").length}
              saving={savingSection === "qr"}
              onReset={() => handleResetSection("qr")}
              onSave={() => handleSaveSection("qr")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "email" && (
        <Card className="border-t-2 border-t-sky-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-sky-500" /> Email Sender Configuration
            </CardTitle>
            <CardDescription>Configure sender identity used in all outgoing email notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="email_sender_name">Sender Name</Label>
                <Input id="email_sender_name" value={settings.email_sender_name || "Dropnfly"}
                  onChange={(e) => handleChange("email_sender_name", e.target.value)}
                  placeholder="Dropnfly" />
                <p className="text-[10px] text-muted-foreground">Display name shown in email clients</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email_reply_to">Reply-To Address</Label>
                <Input id="email_reply_to" type="email" value={settings.email_reply_to || ""}
                  onChange={(e) => handleChange("email_reply_to", e.target.value)}
                  placeholder="support@dropnfly.ph" className="font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground">Replies go to this address</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email_company_name">Company Name</Label>
                <Input id="email_company_name" value={settings.email_company_name || "Dropnfly Logistics Inc."}
                  onChange={(e) => handleChange("email_company_name", e.target.value)}
                  placeholder="Dropnfly Logistics Inc." />
                <p className="text-[10px] text-muted-foreground">Used in email signatures and footers</p>
              </div>
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("email").length}
              saving={savingSection === "email"}
              onReset={() => handleResetSection("email")}
              onSave={() => handleSaveSection("email")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "terms" && (
        <Card className="border-t-2 border-t-blue-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-blue-500" /> Terms &amp; Privacy Policy
            </CardTitle>
            <CardDescription>Edit the legal text shown to customers during booking. These appear in the Terms &amp; Conditions and Privacy Policy modals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="terms_and_conditions">Terms &amp; Conditions</Label>
              <p className="text-[10px] text-muted-foreground">Plain text; blank line between sections. Line breaks are preserved.</p>
              <textarea
                id="terms_and_conditions"
                value={settings.terms_and_conditions || ""}
                onChange={(e) => handleChange("terms_and_conditions", e.target.value)}
                className="min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="privacy_policy">Privacy Policy</Label>
              <p className="text-[10px] text-muted-foreground">Plain text; blank line between sections. Line breaks are preserved.</p>
              <textarea
                id="privacy_policy"
                value={settings.privacy_policy || ""}
                onChange={(e) => handleChange("privacy_policy", e.target.value)}
                className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("terms").length}
              saving={savingSection === "terms"}
              onReset={() => handleResetSection("terms")}
              onSave={() => handleSaveSection("terms")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "maintenance" && (
        <Card className="border-t-2 border-t-red-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-red-500" /> Maintenance Mode
            </CardTitle>
            <CardDescription>When enabled, customers see a maintenance message instead of the booking page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Maintenance Mode</p>
                    <p className="text-xs text-muted-foreground">Temporarily disable the booking page for maintenance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={settings.maintenance_mode_enabled === "true" ? "destructive" : "secondary"} className="text-[10px]">
                      {settings.maintenance_mode_enabled === "true" ? "Active" : "Inactive"}
                    </Badge>
                    <select value={settings.maintenance_mode_enabled || "false"}
                      onChange={(e) => handleChange("maintenance_mode_enabled", e.target.value)}
                      className="h-7 w-16 rounded-md border px-1 text-xs">
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </div>
                </div>
              </div>
              {settings.maintenance_mode_enabled === "true" && (
                <div className="space-y-1.5">
                  <Label htmlFor="maintenance_message">Maintenance Message</Label>
                  <textarea id="maintenance_message"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                    value={settings.maintenance_message || ""}
                    onChange={(e) => handleChange("maintenance_message", e.target.value)}
                    placeholder="We are currently undergoing scheduled maintenance..." />
                  <p className="text-[10px] text-muted-foreground">This message is displayed on the booking page when maintenance mode is on</p>
                </div>
              )}
            </div>
            <SectionFooter
              dirtyCount={getSectionDirty("maintenance").length}
              saving={savingSection === "maintenance"}
              onReset={() => handleResetSection("maintenance")}
              onSave={() => handleSaveSection("maintenance")}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "fleet" && (
        <FleetSection
          fleet={getFleet()}
          onAdd={addVehicle}
          onUpdate={updateVehicle}
          onRemove={removeVehicle}
          onReset={() => handleResetSection("fleet")}
          dirtyCount={getSectionDirty("fleet").length}
          saving={savingSection === "fleet"}
          onSave={() => handleSaveSection("fleet")}
        />
      )}
    </div>
  );
}

function SectionFooter({
  dirtyCount,
  saving,
  onReset,
  onSave,
}: {
  dirtyCount: number;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      {dirtyCount > 0 ? (
        <Badge variant="warning" className="gap-1.5 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          {dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">All changes saved</span>
      )}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReset} disabled={saving}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || dirtyCount === 0}>
          <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function FleetSection({ fleet, onAdd, onUpdate, onRemove, onReset, dirtyCount, saving, onSave }: {
  fleet: FleetVehicle[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof FleetVehicle, value: string | number) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
}) {
  const totalVehicles = fleet.reduce((sum, v) => sum + v.count, 0);

  return (
    <div className="space-y-4">
      <Card className="border-t-2 border-t-yellow-500 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-yellow-600" /> Fleet Management
              </CardTitle>
              <CardDescription>
                Manage your fleet of vehicles used for pick-up and delivery. The number of vehicles determines available time slots for logistics.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <Truck className="h-3 w-3" /> {totalVehicles} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {fleet.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Truck className="mb-2 h-8 w-8" />
              <p className="text-sm font-medium">No vehicles configured</p>
              <p className="text-xs">Add vehicles to manage logistics capacity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fleet.map((v) => {
                const Icon = v.icon === "bike" ? Bike : v.icon === "truck" ? Truck : Car;
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background shadow-sm">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Input value={v.type}
                        onChange={(e) => onUpdate(v.id, "type", e.target.value)}
                        className="h-8 text-sm font-medium" placeholder="Vehicle type" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Count</Label>
                      <Input type="number" min="1" className="h-8 w-20 font-mono text-center"
                        value={v.count}
                        onChange={(e) => onUpdate(v.id, "count", parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Icon</Label>
                      <select value={v.icon}
                        onChange={(e) => onUpdate(v.id, "icon", e.target.value)}
                        className="h-8 rounded-md border px-2 text-xs">
                        <option value="bike">Bike</option>
                        <option value="car">Car</option>
                        <option value="truck">Truck</option>
                      </select>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onRemove(v.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Plus className="mr-1 h-4 w-4" /> Add Vehicle
            </Button>
            {fleet.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
                Clear All
              </Button>
            )}
          </div>
          <SectionFooter
            dirtyCount={dirtyCount}
            saving={saving}
            onReset={onReset}
            onSave={onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
