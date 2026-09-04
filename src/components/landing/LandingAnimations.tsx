"use client";

import { useRef, useState, useEffect } from "react";
import { useInView } from "framer-motion";
import { Star } from "lucide-react";

export function AnimatedCounter({ to, suffix = "" }: { to: number; suffix?: string }) {
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

export function FadeIn({
  children,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const transformMap = {
    up: "translateY(40px)",
    down: "translateY(-40px)",
    left: "translateX(40px)",
    right: "translateX(-40px)",
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "translate(0, 0)" : transformMap[direction],
        transition: `opacity 0.6s cubic-bezier(0.21, 0.47, 0.32, 0.98) ${delay}s, transform 0.6s cubic-bezier(0.21, 0.47, 0.32, 0.98) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export function StarRating({ rating }: { rating: number }) {
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

export function FloatingElements() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-[15%] top-[30%] h-16 w-16 rounded-2xl border bg-blue-500/10 shadow-lg"
        style={{ animation: "float-y-1 4s ease-in-out infinite" }}
      />
      <div
        className="absolute right-[20%] top-[25%] h-12 w-12 rounded-xl border bg-orange-500/10 shadow-lg"
        style={{ animation: "float-y-2 5s ease-in-out infinite 1s" }}
      />
      <div
        className="absolute bottom-[30%] left-[25%] h-20 w-20 rounded-2xl border bg-blue-500/10 shadow-lg"
        style={{ animation: "float-y-1 6s ease-in-out infinite 0.5s" }}
      />
      <div
        className="absolute right-[30%] top-[40%] h-8 w-8 rounded-full border-2 border-blue-500/20"
        style={{ animation: "spin-slow 20s linear infinite" }}
      />
      <div
        className="absolute bottom-[25%] right-[15%] h-6 w-6 rounded-full border-2 border-violet-500/20"
        style={{ animation: "spin-slow 25s linear infinite reverse" }}
      />
      <style>{`
        @keyframes float-y-1 { 0%, 100% { transform: translateY(-8px); } 50% { transform: translateY(8px); } }
        @keyframes float-y-2 { 0%, 100% { transform: translateY(6px); } 50% { transform: translateY(-6px); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export function CTAFloatingDots() {
  return (
    <>
      <div
        className="absolute -left-4 top-1/4 h-3 w-3 rounded-full bg-white/20"
        style={{ animation: "float-y-cta-1 3s ease-in-out infinite" }}
      />
      <div
        className="absolute -right-2 bottom-1/3 h-4 w-4 rounded-full bg-white/15"
        style={{ animation: "float-y-cta-2 4s ease-in-out infinite 1s" }}
      />
      <style>{`
        @keyframes float-y-cta-1 { 0%, 100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
        @keyframes float-y-cta-2 { 0%, 100% { transform: translateY(4px); } 50% { transform: translateY(-4px); } }
      `}</style>
    </>
  );
}
