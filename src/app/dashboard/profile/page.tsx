"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { User, Mail, Shield, Calendar, ShieldCheck, Smartphone, QrCode as QrCodeIcon } from "lucide-react";
import Link from "next/link";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  totpEnabled?: boolean;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setName(data.name || "");
        setTotpEnabled(data.totpEnabled === true);
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleTotpSetup() {
    setTotpLoading(true);
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start setup");
      setTotpSetup(data);
      setTotpCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleTotpConfirm() {
    if (!totpSetup || totpCode.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setTotpLoading(true);
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", secret: totpSetup.secret, code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify code");
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode("");
      toast.success("Two-factor authentication enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleTotpDisable() {
    setTotpLoading(true);
    try {
      const res = await fetch("/api/auth/totp", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disable");
      setTotpEnabled(false);
      toast.success("Two-factor authentication disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleUpdateName() {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update profile");
      } else {
        setProfile((prev) => prev ? { ...prev, name: data.name } : prev);
        toast.success("Profile updated successfully");
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to change password");
      } else {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{profile?.name || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{profile?.email || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{profile?.role?.toLowerCase() || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">{profile?.createdAt ? formatDate(profile.createdAt) : "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Edit Name</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button onClick={handleUpdateName} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {profile?.role === "ADMIN" && (
        <Card className="border-t-2 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to your admin login using Google Authenticator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {totpEnabled ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Enabled</p>
                    <p className="text-xs text-green-700">
                      A verification code is required each time you sign in.
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleTotpDisable} disabled={totpLoading}>
                  Disable
                </Button>
              </div>
            ) : totpSetup ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="mb-3 text-sm font-medium">Scan this QR code with Google Authenticator</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={totpSetup.qrDataUrl} alt="TOTP QR code" className="mx-auto h-48 w-48 rounded-lg border bg-white" />
                  <p className="mt-3 text-xs text-muted-foreground break-all font-mono">{totpSetup.secret}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totpCode">Verification Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="totpCode"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      className="font-mono tracking-[0.3em]"
                    />
                    <Button onClick={handleTotpConfirm} disabled={totpLoading} className="bg-orange-500 text-white hover:bg-orange-600">
                      {totpLoading ? "Verifying..." : "Verify & Enable"}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setTotpSetup(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <QrCodeIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">Not enabled</p>
                  </div>
                </div>
                <Button onClick={handleTotpSetup} disabled={totpLoading} className="bg-orange-500 text-white hover:bg-orange-600">
                  {totpLoading ? "Preparing..." : "Set Up"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
