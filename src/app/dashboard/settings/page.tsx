"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const defaultSettings: Record<string, { label: string; type: "text" | "number" | "boolean" }> = {
  price_per_kg: { label: "Price per kg (PHP)", type: "number" },
  storage_capacity_limit: { label: "Max Storage Capacity", type: "number" },
  max_bags_per_booking: { label: "Max Bags per Booking", type: "number" },
  allow_guest_booking: { label: "Allow Guest Booking", type: "boolean" },
  require_employee_approval: { label: "Require Employee Approval", type: "boolean" },
  email_notifications: { label: "Enable Email Notifications", type: "boolean" },
  smtp_host: { label: "SMTP Host", type: "text" },
  smtp_port: { label: "SMTP Port", type: "number" },
  smtp_from: { label: "SMTP From Address", type: "text" },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setSettings)
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        toast.error("Failed to save settings");
      } else {
        toast.success("Settings saved successfully");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">System Settings</h1>

      <Card className="border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Pricing & Capacity</CardTitle>
          <CardDescription>Configure pricing and storage limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(defaultSettings).map(([key, config]) => {
            if (key === "smtp_host" || key === "smtp_port" || key === "smtp_from") return null;
            return (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{config.label}</Label>
                {config.type === "boolean" ? (
                  <Select
                    id={key}
                    value={settings[key] || "true"}
                    onChange={(e) => handleChange(key, e.target.value)}
                    options={[
                      { value: "true", label: "Enabled" },
                      { value: "false", label: "Disabled" },
                    ]}
                  />
                ) : (
                  <Input
                    id={key}
                    type={config.type}
                    value={settings[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>SMTP settings for email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smtp_host">SMTP Host</Label>
            <Input
              id="smtp_host"
              value={settings.smtp_host || ""}
              onChange={(e) => handleChange("smtp_host", e.target.value)}
              placeholder="smtp.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp_port">SMTP Port</Label>
            <Input
              id="smtp_port"
              type="number"
              value={settings.smtp_port || ""}
              onChange={(e) => handleChange("smtp_port", e.target.value)}
              placeholder="587"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp_from">From Address</Label>
            <Input
              id="smtp_from"
              value={settings.smtp_from || ""}
              onChange={(e) => handleChange("smtp_from", e.target.value)}
              placeholder="noreply@dropnfly.ph"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-t-2 border-t-primary">
        <CardContent>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
