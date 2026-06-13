"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ChatBot = dynamic(() => import("@/components/chat/ChatBot"), { ssr: false });
import {
  Luggage,
  MapPin,
  QrCode,
  Shield,
  Clock,
  HeadphonesIcon,
  ChevronRight,
  Star,
  CheckCircle,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";

const navLinks = [
  { href: "/book", label: "Book a Pickup" },
  { href: "/track", label: "Track Luggage" },
  { href: "/my-account/login", label: "My Account" },
  { href: "/login", label: "Staff Login" },
];

const features = [
  {
    icon: Luggage,
    title: "Easy Booking",
    desc: "Schedule pickup in under 60 seconds. No account needed.",
  },
  {
    icon: MapPin,
    title: "Real-time Tracking",
    desc: "Live GPS tracking from pickup to delivery.",
  },
  {
    icon: QrCode,
    title: "QR Code Access",
    desc: "Scan your QR code for instant status updates.",
  },
  {
    icon: Shield,
    title: "Secure Storage",
    desc: "Insured storage facilities with 24/7 monitoring.",
  },
  {
    icon: Clock,
    title: "On-Time Delivery",
    desc: "Guaranteed delivery within your preferred window.",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    desc: "Our team is always available to assist you.",
  },
];

const steps = [
  {
    num: "01",
    title: "Book a Pickup",
    desc: "Tell us where and when to pick up your luggage. No registration required.",
  },
  {
    num: "02",
    title: "We Handle It",
    desc: "Our staff collects, stores, and transports your luggage securely.",
  },
  {
    num: "03",
    title: "Delivered to You",
    desc: "Track in real-time and receive your luggage at your destination.",
  },
];

const testimonials = [
  {
    name: "Maria Santos",
    role: "Frequent Traveler",
    content:
      "Dropnfly made my business trip seamless. Dropped my bags at the hotel and they delivered them to my meeting venue. Incredible service!",
    rating: 5,
  },
  {
    name: "James Reyes",
    role: "Tourist",
    content:
      "Arrived in Manila with 4 hours to explore before my flight. Dropnfly stored my luggage and I explored hands-free. Game changer!",
    rating: 5,
  },
  {
    name: "Ana Lim",
    role: "Digital Nomad",
    content:
      "The real-time tracking gave me peace of mind. I could see exactly where my luggage was at all times. Highly recommend!",
    rating: 5,
  },
];

const stats = [
  { label: "Luggage Handled", value: 15420 },
  { label: "Happy Customers", value: 8930 },
  { label: "Cities Covered", value: 12 },
  { label: "On-Time Rate", value: 98, suffix: "%" },
];

function AnimatedCounter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
    const increment = to / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= to) {
        setCount(to);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [isInView, to]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

function FadeIn({
  children,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const dirMap = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Navbar */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-background/80 backdrop-blur-xl"
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg">
              <Luggage className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">
              Drop<span className="text-blue-600">nfly</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/book"
              className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-medium text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 hover:brightness-110"
            >
              Book Now
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t bg-background px-4 pb-4 md:hidden"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/book"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white"
              onClick={() => setMobileOpen(false)}
            >
              Book Now
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] pt-24">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute -right-40 -top-20 h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[120px]" />
          <div className="absolute -bottom-40 left-1/3 h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[120px]" />

          {/* Grid pattern */}
          <svg className="absolute inset-0 h-full w-full opacity-[0.03]">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="container relative mx-auto flex flex-col items-center px-4 pb-20 pt-16 text-center lg:pt-28">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            No registration needed
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Travel Light.{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-500 to-cyan-500 bg-clip-text text-transparent">
              We Carry the Load.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
          >
            On-demand luggage pickup, storage, and delivery service. Schedule a
            pickup and we&apos;ll get your bags where they need to go — so you
            can enjoy the journey hands-free.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link
              href="/book"
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 text-sm font-semibold text-white shadow-xl shadow-blue-600/30 transition-all hover:shadow-2xl hover:shadow-blue-600/40 hover:brightness-110"
            >
              Book a Pickup
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/track"
              className="inline-flex h-12 items-center gap-2 rounded-xl border px-8 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:shadow-md"
            >
              <MapPin className="h-4 w-4" />
              Track Luggage
            </Link>
          </motion.div>

          {/* Floating elements */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              animate={{ y: [-8, 8, -8] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-[15%] top-[30%] h-16 w-16 rounded-2xl border bg-gradient-to-br from-blue-500/10 to-blue-500/5 shadow-lg backdrop-blur-sm"
            />
            <motion.div
              animate={{ y: [6, -6, 6] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute right-[20%] top-[25%] h-12 w-12 rounded-xl border bg-gradient-to-br from-violet-500/10 to-violet-500/5 shadow-lg backdrop-blur-sm"
            />
            <motion.div
              animate={{ y: [-10, 10, -10] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute bottom-[30%] left-[25%] h-20 w-20 rounded-2xl border bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 shadow-lg backdrop-blur-sm"
            />
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute right-[30%] top-[40%] h-8 w-8 rounded-full border-2 border-blue-500/20"
            />
            <motion.div
              animate={{ rotate: [360, 0] }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-[25%] right-[15%] h-6 w-6 rounded-full border-2 border-violet-500/20"
            />
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative border-y bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="text-3xl font-bold tracking-tight md:text-4xl">
                  <AnimatedCounter to={stat.value} suffix={stat.suffix || ""} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                How It Works
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Three Simple Steps
              </h2>
              <p className="mt-3 text-muted-foreground">
                From booking to delivery, we make luggage handling effortless.
              </p>
            </div>
          </FadeIn>

          <div className="relative mt-16 grid gap-8 md:grid-cols-3">
            {/* Connecting line */}
            <div className="absolute left-[15%] right-[15%] top-12 hidden h-0.5 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500 md:block" />

            {steps.map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.15}>
                <div className="group relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border bg-gradient-to-br from-blue-500 to-violet-500 shadow-xl shadow-blue-500/20 transition-all group-hover:shadow-2xl group-hover:shadow-blue-500/30 group-hover:scale-105">
                    <span className="text-2xl font-bold text-white">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-y bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                Why Dropnfly
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Everything You Need
              </h2>
              <p className="mt-3 text-muted-foreground">
                We provide a complete luggage handling experience from start to
                finish.
              </p>
            </div>
          </FadeIn>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <FadeIn key={feature.title} delay={i * 0.08}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group rounded-xl border bg-card p-6 transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 dark:hover:border-blue-800"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 text-blue-600 transition-all group-hover:from-blue-500 group-hover:to-violet-500 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {feature.desc}
                    </p>
                  </motion.div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-block rounded-full bg-cyan-100 px-4 py-1.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                Testimonials
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Loved by Travelers
              </h2>
              <p className="mt-3 text-muted-foreground">
                See what our customers say about their experience.
              </p>
            </div>
          </FadeIn>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="group rounded-xl border bg-card p-6 transition-all hover:shadow-lg"
                >
                  <StarRating rating={t.rating} />
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{t.content}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t pt-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
                      {t.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzek0yNyAyNWMxLjY1NyAwIDMtMS4zNDMgMy0zcy0xLjM0My0zLTMtMy0zIDEuMzQzLTMgMyAxLjM0MyAzIDMgM3oiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

        <div className="container relative mx-auto px-4 text-center">
          <FadeIn>
            <motion.h2
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="text-3xl font-bold tracking-tight text-white md:text-5xl"
            >
              Ready to Travel Hands-Free?
            </motion.h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-100">
              Book your first pickup today. No registration, no hassle — just
              show up and go.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-sm font-semibold text-blue-700 shadow-xl transition-all hover:shadow-2xl hover:brightness-105"
              >
                Get Started Free
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/track"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-8 text-sm font-semibold text-white transition-all hover:bg-white/10"
              >
                Track Existing Booking
              </Link>
            </div>
          </FadeIn>

          {/* Floating dots */}
          <motion.div
            animate={{ y: [-6, 6, -6] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-4 top-1/4 h-3 w-3 rounded-full bg-white/20"
          />
          <motion.div
            animate={{ y: [4, -4, 4] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute -right-2 bottom-1/3 h-4 w-4 rounded-full bg-white/15"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
                  <Luggage className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-bold">
                  Drop<span className="text-blue-600">nfly</span>
                </span>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">
                On-demand luggage storage and delivery service for modern
                travelers.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold">Quick Links</h4>
              <ul className="mt-4 space-y-2.5">
                {[
                  { href: "/book", label: "Book a Pickup" },
                  { href: "/track", label: "Track Luggage" },
                  { href: "/login", label: "Staff Login" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Features */}
            <div>
              <h4 className="text-sm font-semibold">Features</h4>
              <ul className="mt-4 space-y-2.5">
                {features.slice(0, 4).map((f) => (
                  <li key={f.title}>
                    <span className="text-sm text-muted-foreground">
                      {f.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold">Contact</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                <li>hello@dropnfly.ph</li>
                <li>+63 (2) 8123 4567</li>
                <li>Metro Manila, PH</li>
              </ul>
              <div className="mt-4 flex gap-3">
                {["FB", "IG", "TW"].map((s) => (
                  <div
                    key={s}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Dropnfly. All rights
            reserved.
          </div>
        </div>
      </footer>

      <ChatBot />
    </div>
  );
}
