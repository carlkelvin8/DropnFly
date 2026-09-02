"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function PublicFooter() {
  const [footer, setFooter] = useState({
    phone: "+63 (2) 1234 5678",
    email: "hello@dropnfly.ph",
    facebook: "",
    instagram: "",
    twitter: "",
    operating_start: "00:00",
    operating_end: "23:59",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/settings", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.footer && !controller.signal.aborted) setFooter(data.footer); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const { phone, email, operating_start: start, operating_end: end } = footer;
  const is24h = start === "00:00" && (end === "23:59" || end === "24:00" || end === "00:00");
  const openLabel = is24h ? "Open 24 hours daily" : `Open ${start}–${end}`;
  const socialLinks = [
    ["Facebook", footer.facebook],
    ["Instagram", footer.instagram],
    ["X / Twitter", footer.twitter],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <footer className="border-t bg-muted/50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-8 text-sm md:grid-cols-3">
          <div>
            <p className="mb-2 font-bold"><span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span></p>
            <p className="text-muted-foreground">Luggage storage and delivery at NAIA Terminals 1–4.</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-foreground/80">Quick Links</p>
            <div className="space-y-1">
              <Link href="/book" className="block text-muted-foreground transition-colors hover:text-blue-600">Book a Pickup</Link>
              <Link href="/track" className="block text-muted-foreground transition-colors hover:text-blue-600">Track Luggage</Link>
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-foreground/80">Support</p>
            <div className="space-y-1">
              <p className="text-muted-foreground">NAIA Terminals 1–4, Pasay City</p>
              <a href={`mailto:${email}`} className="block text-muted-foreground hover:text-blue-600">{email}</a>
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="block text-muted-foreground hover:text-blue-600">{phone}</a>
              <p className="text-muted-foreground">{openLabel}</p>
              {socialLinks.length > 0 && <div className="flex flex-wrap gap-3 pt-1">{socialLinks.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-blue-600">{label}</a>)}</div>}
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Dropnfly. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
