"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Luggage, UserPlus, AlertCircle, Check } from "lucide-react";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirmPassword") as string;

    if (password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/my-account");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.03]">
          <defs>
            <pattern id="reg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#reg-grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
              <Luggage className="h-6 w-6 text-white" />
            </div>
            <div className="text-left">
              <span className="text-2xl font-bold text-white">
                Drop<span className="text-blue-400">nfly</span>
              </span>
              <p className="text-[11px] text-white/40 font-medium tracking-wider uppercase">Create Account</p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/5">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-white">Join Dropnfly</h1>
            <p className="mt-1.5 text-sm text-white/50">Create your account in seconds</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-white/70">Full Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Juan Dela Cruz"
                required
                className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/70">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@email.com"
                required
                className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-white/70">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+63 912 345 6789"
                required
                className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-white/70">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Min 6 chars"
                  minLength={6}
                  required
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">Confirm</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repeat"
                  required
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="relative h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </>
                )}
              </span>
            </Button>
          </form>

          {/* Benefits */}
          <div className="mt-6 rounded-xl bg-white/[0.03] border border-white/5 p-4">
            <p className="text-xs font-medium text-white/40 mb-2.5 uppercase tracking-wider">What you get</p>
            <div className="space-y-2">
              {["Real-time luggage tracking", "Loyalty points & rewards", "Priority customer support"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-white/50">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-white/40">
            Already have an account?{" "}
            <Link href="/my-account/login" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
