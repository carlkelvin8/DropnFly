import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { invalidateSettingsCache } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return NextResponse.json(map);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    if (!body || Array.isArray(body) || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "No settings supplied" }, { status: 400 });
    }

    // Sanitize entries: keys must be non-empty strings, values coerced to string (allow empty)
    const entries = Object.entries(body).filter(([k, v]) => typeof k === "string" && k.trim().length > 0 && k.length <= 100 && v !== undefined && v !== null);
    if (entries.length === 0) {
      return NextResponse.json({ error: "No valid settings supplied" }, { status: 400 });
    }
    // Guard against excessively large payload (e.g., accidental huge terms)
    for (const [k, v] of entries) {
      const str = String(v);
      if (str.length > 20000) {
        return NextResponse.json({ error: `Value for ${k} is too large (max 20000 chars)` }, { status: 400 });
      }
      if (k.length > 100) {
        return NextResponse.json({ error: `Key ${k.slice(0, 30)} is too long` }, { status: 400 });
      }
    }

    // Use batched upserts instead of fully sequential writes.
    // A single $transaction with 40+ ops can hit interactive transaction
    // timeouts, so we chunk into smaller parallel batches. This dramatically
    // reduces wall-clock time vs. one sequential round-trip per setting.
    const cleanEntries = entries.map(([k, v]) => [k.trim(), String(v)] as const);

    const BATCH_SIZE = 8;

    for (let i = 0; i < cleanEntries.length; i += BATCH_SIZE) {
      const batch = cleanEntries.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map(([key, value]) =>
          prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        ),
        { maxWait: 15000, timeout: 15000 }
      );
    }

    invalidateSettingsCache();

    try {
      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "SystemSetting",
        details: `Updated settings: ${entries.map(([k]) => k).join(", ").slice(0, 1000)}`,
      });
    } catch (logErr) {
      console.warn("[SETTINGS] logActivity failed (non-fatal):", logErr);
    }

    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return NextResponse.json(map);
  } catch (e) {
    console.error("[SETTINGS] PUT failed:", e);
    const message = e instanceof Error ? e.message : "Failed to update settings";
    // Avoid leaking internal details but give actionable message
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  }
}
