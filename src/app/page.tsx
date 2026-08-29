import Link from "next/link";
import {
  Luggage,
  MapPin,
  QrCode,
  Shield,
  Clock,
  HeadphonesIcon,
  ChevronRight,
} from "lucide-react";
import { LandingNavbar } from "@/components/landing/Navbar";
import {
  AnimatedCounter,
  FadeIn,
  StarRating,
  FloatingElements,
  CTAFloatingDots,
} from "@/components/landing/LandingAnimations";
import { ChatBotClient } from "@/components/landing/ChatBotClient";

const features = [
  { icon: Luggage, title: "Easy Booking", desc: "Schedule pickup in under 60 seconds. No account needed." },
  { icon: MapPin, title: "Real-time Tracking", desc: "Live GPS tracking from pickup to delivery." },
  { icon: QrCode, title: "QR Code Access", desc: "Scan your QR code for instant status updates." },
  { icon: Shield, title: "Secure Storage", desc: "Insured storage facilities with 24/7 monitoring." },
  { icon: Clock, title: "On-Time Delivery", desc: "Guaranteed delivery within your preferred window." },
  { icon: HeadphonesIcon, title: "24/7 Support", desc: "Our team is always available to assist you." },
];

const steps = [
  { num: "01", title: "Book a Pickup", desc: "Tell us where and when to pick up your luggage. No registration required." },
  { num: "02", title: "We Handle It", desc: "Our staff collects, stores, and transports your luggage securely." },
  { num: "03", title: "Delivered to You", desc: "Track in real-time and receive your luggage at your destination." },
];

const testimonials = [
  { name: "Maria Santos", role: "Frequent Traveler", content: "Dropnfly made my business trip seamless. Dropped my bags at the hotel and they delivered them to my meeting venue. Incredible service!", rating: 5 },
  { name: "James Reyes", role: "Tourist", content: "Arrived in Manila with 4 hours to explore before my flight. Dropnfly stored my luggage and I explored hands-free. Game changer!", rating: 5 },
  { name: "Ana Lim", role: "Digital Nomad", content: "The real-time tracking gave me peace of mind. I could see exactly where my luggage was at all times. Highly recommend!", rating: 5 },
];

const stats = [
  { label: "Luggage Handled", value: 15420 },
  { label: "Happy Customers", value: 8930 },
  { label: "Cities Covered", value: 12 },
  { label: "On-Time Rate", value: 98, suffix: "%" },
];

function maskName(name: string): string {
  return name
    .split(" ")
    .map((part) => {
      if (part.length <= 2) return part[0] + "*";
      return part[0] + "*".repeat(part.length - 2) + part[part.length - 1];
    })
    .join(" ");
}

export default function Home() {
  return (
    <div className="scroll-smooth flex min-h-screen flex-col overflow-x-hidden">
      <LandingNavbar />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-4 focus:rounded-lg focus:bg-orange-500 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <main id="main-content">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] pt-24">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[120px]" />
            <div className="absolute -right-40 -top-20 h-[400px] w-[400px] rounded-full bg-violet-500/[0.05] blur-[120px]" />
            <div className="absolute -bottom-40 left-1/3 h-[350px] w-[350px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
            <svg className="absolute inset-0 h-full w-full opacity-[0.03]" aria-hidden="true">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="container relative mx-auto flex flex-col items-center px-4 pb-20 pt-16 text-center lg:pt-28">
            <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              No registration needed
            </span>

            <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Travel Light.{" "}
              <span className="text-orange-500">
                We Carry the Load.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              On-demand luggage pickup, storage, and delivery service. Schedule a
              pickup and we&apos;ll get your bags where they need to go — so you
              can enjoy the journey hands-free.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                href="/book"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-orange-500 px-8 text-sm font-semibold text-white shadow-xl shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-2xl hover:shadow-orange-500/40"
              >
                Book Now
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/track"
                className="inline-flex h-12 items-center gap-2 rounded-xl border px-8 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:shadow-md"
              >
                <MapPin className="h-4 w-4" />
                Track Luggage
              </Link>
            </div>

            <FloatingElements />
          </div>
        </section>

        {/* Stats Bar */}
        <section className="relative border-y bg-muted/30">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold tracking-tight md:text-4xl">
                    <AnimatedCounter to={stat.value} suffix={stat.suffix || ""} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 md:py-28">
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
              <div className="absolute left-[15%] right-[15%] top-12 hidden h-0.5 bg-orange-500 md:block" />
              {steps.map((step, i) => (
                <FadeIn key={step.num} delay={i * 0.15}>
                  <div className="group relative flex flex-col items-center text-center">
                    <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border bg-orange-500 shadow-xl shadow-orange-500/20 transition-all group-hover:shadow-2xl group-hover:shadow-orange-500/30 group-hover:scale-105">
                      <span className="text-2xl font-bold text-white">{step.num}</span>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="why-choose-us" className="border-y bg-muted/30 py-20 md:py-28">
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
                  We provide a complete luggage handling experience from start to finish.
                </p>
              </div>
            </FadeIn>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <FadeIn key={feature.title} delay={i * 0.08}>
                    <div className="group rounded-xl border bg-card p-6 transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 dark:hover:border-blue-800">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-all group-hover:bg-orange-500 group-hover:text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 font-semibold">{feature.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-20 md:py-28">
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
                  <div className="group rounded-xl border bg-card p-6 transition-all hover:shadow-lg">
                    <StarRating rating={t.rating} />
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{t.content}&rdquo;
                    </p>
                    <div className="mt-6 flex items-center gap-3 border-t pt-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                        {t.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{maskName(t.name)}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section — same background as "Travel Light. We Carry the Load." hero */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[120px]" />
            <div className="absolute -right-40 -top-20 h-[400px] w-[400px] rounded-full bg-violet-500/[0.05] blur-[120px]" />
            <div className="absolute -bottom-40 left-1/3 h-[350px] w-[350px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
            <svg className="absolute inset-0 h-full w-full opacity-[0.03]" aria-hidden="true">
              <defs>
                <pattern id="cta-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cta-grid)" />
            </svg>
          </div>

          <div className="container relative mx-auto px-4 text-center">
            <FadeIn>
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
                Ready to Travel Hands-Free?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Book your first pickup today. No registration, no hassle — just
                show up and go.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/book"
                  className="group inline-flex h-12 items-center gap-2 rounded-xl bg-orange-500 px-8 text-sm font-semibold text-white shadow-xl shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-2xl hover:shadow-orange-500/40"
                >
                  Get Started Free
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/track"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border px-8 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:shadow-md"
                >
                  Track Existing Booking
                </Link>
              </div>
            </FadeIn>
            <CTAFloatingDots />
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: "Dropnfly",
              description: "On-demand luggage pickup, storage, and delivery service at NAIA Terminals 1-4",
              url: "https://dropnfly.ph",
              telephone: "+63-2-8123-4567",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Pasay City",
                addressRegion: "Metro Manila",
                addressCountry: "PH",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 14.5086,
                longitude: 121.0194,
              },
              priceRange: "₱150-₱300",
            }),
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
                  <Luggage className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-bold">
                  <span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span>
                </span>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">
                On-demand luggage storage and delivery service for modern travelers.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Quick Links</h4>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link href="/book" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Book a Pickup
                  </Link>
                </li>
                <li>
                  <Link href="/track" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Track Luggage
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Features</h4>
              <ul className="mt-4 space-y-2.5">
                {features.slice(0, 4).map((f) => (
                  <li key={f.title}>
                    <a href="#why-choose-us" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {f.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Contact</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                <li>hello@dropnfly.ph</li>
                <li>+63 (2) 8123 4567</li>
                <li>Metro Manila, PH</li>
              </ul>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://facebook.com/dropnfly"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Follow us on Facebook"
                >
                  FB
                </a>
                <a
                  href="https://instagram.com/dropnfly"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Follow us on Instagram"
                >
                  IG
                </a>
                <a
                  href="https://twitter.com/dropnfly"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Follow us on Twitter"
                >
                  TW
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Dropnfly. All rights reserved.
          </div>
        </div>
      </footer>

      <ChatBotClient />
    </div>
  );
}
