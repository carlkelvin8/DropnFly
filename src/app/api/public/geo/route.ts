import { NextResponse } from "next/server";
import { FALLBACK_COUNTRIES, FALLBACK_CITIES } from "@/components/booking/constants";

export const dynamic = "force-dynamic";

const DOWNSTREAM_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DOWNSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function GET() {
  try {
    const res = await fetchWithTimeout("https://restcountries.com/v3.1/all?fields=name,cca2");
    if (res.ok) {
      const data: unknown = await res.json();
      const list: { name: { common: string }; cca2: string }[] = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        const byName = new Map<string, { name: string; code: string }>();
        for (const name of FALLBACK_COUNTRIES) {
          byName.set(name.toLocaleLowerCase(), { name, code: name });
        }
        for (const country of list) {
          const n = country.name?.common;
          if (typeof n === "string" && typeof country.cca2 === "string") {
            byName.set(n.toLocaleLowerCase(), { name: n, code: country.cca2 });
          }
        }
        return NextResponse.json(
          { countries: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)) },
          { headers: { "Cache-Control": "public, max-age=86400" } }
        );
      }
    }
  } catch (error) {
    console.error("Countries proxy upstream failed:", error);
  }

  return NextResponse.json(
    { countries: FALLBACK_COUNTRIES.map((name) => ({ name, code: name })).sort((a, b) => a.name.localeCompare(b.name)) },
    { headers: { "Cache-Control": "public, max-age=86400" } }
  );
}

export async function POST(request: Request) {
  let body: { country?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const country = typeof body.country === "string" ? body.country.trim() : "";
  if (!country) {
    return NextResponse.json({ error: "Country is required" }, { status: 400 });
  }

  const fromFallback = FALLBACK_CITIES[country];
  if (fromFallback) {
    return NextResponse.json({ cities: [...fromFallback].sort() }, { headers: { "Cache-Control": "public, max-age=86400" } });
  }

  try {
    const res = await fetchWithTimeout("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    if (res.ok) {
      const data: unknown = await res.json();
      const raw = (data as { data?: unknown })?.data;
      if (Array.isArray(raw)) {
        const cities = raw.filter((c): c is string => typeof c === "string");
        if (cities.length > 0) {
          return NextResponse.json(
            { cities: cities.map(stripDiacritics).sort() },
            { headers: { "Cache-Control": "public, max-age=86400" } }
          );
        }
      }
    }
  } catch (error) {
    console.error("Cities proxy upstream failed:", error);
  }

  return NextResponse.json({ cities: [] }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
