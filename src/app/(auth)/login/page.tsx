"use client";

import { useState, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Luggage, Eye, EyeOff, LogIn, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FloatingOrb({
  size,
  color,
  x,
  y,
  delay,
  duration,
}: {
  size: number;
  color: string;
  x: string;
  y: string;
  delay: number;
  duration: number;
}) {
  return (
    <div
      className="absolute rounded-full blur-3xl"
      style={{
        width: size,
        height: size,
        background: color,
        left: x,
        top: y,
        animation: `orb-move ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

function Particle() {
  const [style] = useState(() => ({
    width: Math.random() * 3 + 1,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
  }));
  const [anim] = useState(() => ({
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 5,
  }));

  return (
    <div
      className="absolute rounded-full bg-blue-400/30"
      style={{
        width: style.width,
        height: style.width,
        left: style.left,
        top: style.top,
        animation: `particle-float ${anim.duration}s ease-in-out ${anim.delay}s infinite`,
      }}
    />
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [success, setSuccess] = useState(registered === "true" ? "Account created! You can now sign in." : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [alternateOrigin] = useState(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    else if (url.hostname === "127.0.0.1") url.hostname = "localhost";
    else return "";
    url.pathname = "/login";
    return url.toString();
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const result = await signIn("credentials", {
      email,
      password,
      ...(showTotp ? { totpCode } : {}),
      redirect: false,
    });

    if (result?.error) {
      if (!showTotp) {
        try {
          const res = await fetch("/api/auth/totp/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (data.valid && data.requiresTotp) {
            setShowTotp(true);
            setError("Two-factor authentication required. Enter the code from your authenticator app.");
            setLoading(false);
            return;
          }
        } catch {
          // fall through to generic error
        }
      }
      setError("Invalid email or password");
      setLoading(false);
    } else {
      const session = await getSession();
      const expired = session?.user?.passwordExpired;
      router.push(expired ? "/dashboard/change-password" : "/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <FloatingOrb size={500} color="rgba(234, 125, 61, 0.15)" x="-10%" y="-20%" delay={0} duration={8} />
        <FloatingOrb size={400} color="rgba(59, 122, 199, 0.12)" x="60%" y="-10%" delay={2} duration={10} />
        <FloatingOrb size={350} color="rgba(59, 122, 199, 0.1)" x="30%" y="60%" delay={4} duration={9} />
        <FloatingOrb size={300} color="rgba(234, 125, 61, 0.08)" x="80%" y="70%" delay={1} duration={7} />

        {/* Grid overlay */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]">
          <defs>
            <pattern id="login-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-grid)" />
        </svg>

        {/* Particles */}
        {Array.from({ length: 30 }).map((_, i) => (
          <Particle key={i} />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full items-center justify-center px-4">
        <div className="w-full max-w-sm" style={{ animation: "fade-scale-in 0.5s ease-out" }}>
          {/* Logo */}
          <div style={{ animation: "fade-down-in 0.5s ease-out 0.1s backwards" }} className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/25" style={{ animation: "logo-wiggle 0.5s ease-in-out 0.3s" }}>
                <Luggage className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                Drop<span className="text-blue-400">nfly</span>
              </span>
            </Link>
          </div>

          {/* Form Card */}
          <div
            style={{ animation: "fade-up-in 0.5s ease-out 0.2s backwards" }}
            className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl"
          >
            <div style={{ animation: "fade-in 0.5s ease-out 0.3s backwards" }} className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-white/60">
                Sign in to the staff and admin portal
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div style={{ animation: "fade-left-in 0.4s ease-out 0.35s backwards" }} className="space-y-2">
                <Label htmlFor="email" className="text-sm text-white/80">
                  Email
                </Label>
                <div className="group relative">
                  <div className="pointer-events-none absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 opacity-0 transition-all duration-300 group-focus-within:from-blue-500/20 group-focus-within:via-blue-500/10 group-focus-within:to-orange-500/20 group-focus-within:opacity-100" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="relative border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                  />
                </div>
              </div>

              <div style={{ animation: "fade-left-in 0.4s ease-out 0.4s backwards" }} className="space-y-2">
                <Label htmlFor="password" className="text-sm text-white/80">
                  Password
                </Label>
                <div className="group relative">
                  <div className="pointer-events-none absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 opacity-0 transition-all duration-300 group-focus-within:from-blue-500/20 group-focus-within:via-blue-500/10 group-focus-within:to-orange-500/20 group-focus-within:opacity-100" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="relative border-white/10 bg-white/5 pr-10 text-white placeholder:text-white/30 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {showTotp && (
                <div style={{ animation: "fade-left-in 0.4s ease-out" }} className="space-y-2">
                  <Label htmlFor="totpCode" className="flex items-center gap-1.5 text-sm text-white/80">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    Two-Factor Code
                  </Label>
                  <Input
                    id="totpCode"
                    name="totpCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    required={showTotp}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="relative border-white/10 bg-white/5 text-center font-mono text-lg tracking-[0.4em] text-white placeholder:text-white/30 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
                  />
                  <p className="text-xs text-white/50">Enter the 6-digit code from your Google Authenticator app.</p>
                </div>
              )}
              {success && (
                <p style={{ animation: "fade-left-in 0.4s ease-out" }} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  {success}
                </p>
              )}
              {error && (
                <p style={{ animation: "fade-left-in 0.4s ease-out" }} className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <div style={{ animation: "fade-up-in 0.4s ease-out 0.5s backwards" }}>
                <Button
                  type="submit"
                  className="relative w-full overflow-hidden bg-orange-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:shadow-xl"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="50" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Staff / Admin Sign In
                    </span>
                  )}
                </Button>
              </div>
            </form>

            <p
              style={{ animation: "fade-in 0.4s ease-out 0.6s backwards" }}
              className="mt-6 text-center text-sm text-white/50"
            >
              Employee accounts are created by your administrator.
            </p>
            {alternateOrigin && (
              <a href={alternateOrigin} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-xs text-blue-300 hover:text-blue-200">
                <ExternalLink className="h-3.5 w-3.5" /> Open an independent login tab
              </a>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes orb-move {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.15; }
          25% { transform: translate(30px, -30px) scale(1.1); opacity: 0.2; }
          50% { transform: translate(-20px, 20px) scale(0.9); opacity: 0.12; }
          75% { transform: translate(10px, -10px) scale(1.05); opacity: 0.18; }
        }
        @keyframes particle-float {
          0%, 100% { transform: translateY(0); opacity: 0; }
          50% { transform: translateY(-30px); opacity: 0.6; }
        }
        @keyframes fade-scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes fade-down-in { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-up-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-left-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes logo-wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
          75% { transform: rotate(-5deg); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
