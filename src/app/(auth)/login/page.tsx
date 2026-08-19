"use client";

import { useState, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
    <motion.div
      className="absolute rounded-full blur-3xl"
      style={{
        width: size,
        height: size,
        background: color,
        left: x,
        top: y,
      }}
      animate={{
        x: [0, 30, -20, 10, 0],
        y: [0, -30, 20, -10, 0],
        scale: [1, 1.1, 0.9, 1.05, 1],
        opacity: [0.15, 0.2, 0.12, 0.18, 0.15],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
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
    <motion.div
      className="absolute rounded-full bg-blue-400/30"
      style={{ width: style.width, height: style.width, left: style.left, top: style.top }}
      animate={{
        y: [0, -30, 0],
        opacity: [0, 0.6, 0],
      }}
      transition={{
        duration: anim.duration,
        delay: anim.delay,
        repeat: Infinity,
        ease: "easeInOut",
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-8 text-center"
          >
            <Link href="/" className="inline-flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/25"
              >
                <Luggage className="h-6 w-6 text-white" />
              </motion.div>
              <span className="text-2xl font-bold text-white">
                Drop<span className="text-blue-400">nfly</span>
              </span>
            </Link>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-6 text-center"
            >
              <h1 className="text-xl font-semibold text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-white/60">Sign in to your account</p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="space-y-2"
              >
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
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="space-y-2"
              >
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
              </motion.div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <AnimatePresence>
                {showTotp && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-2"
                  >
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
                  </motion.div>
                )}
                {success && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
                  >
                    {success}
                  </motion.p>
                )}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Button
                    type="submit"
                    className="relative w-full overflow-hidden bg-orange-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:shadow-xl"
                    disabled={loading}
                    size="lg"
                  >
                    {/* Shimmer */}
                    <motion.div
                      className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="50" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Sign In
                      </span>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mt-6 text-center text-sm text-white/50"
            >
              Employee accounts are created by your administrator.
            </motion.p>
            {alternateOrigin && (
              <a href={alternateOrigin} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-xs text-blue-300 hover:text-blue-200">
                <ExternalLink className="h-3.5 w-3.5" /> Open an independent login tab
              </a>
            )}
          </motion.div>
        </motion.div>
      </div>
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
