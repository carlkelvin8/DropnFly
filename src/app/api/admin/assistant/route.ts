import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { ADMIN_AI_INSTRUCTIONS, parseAdminAIRequest } from "@/lib/admin-ai";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const limit = await rateLimit(`admin-ai:${session.user.id}`, 10, 60000);
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before sending another message." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  let body;
  try {
    const text = await request.text();
    if (text.length > 60000) return NextResponse.json({ error: "Conversation too large" }, { status: 413 });
    body = parseAdminAIRequest(JSON.parse(text));
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body) return NextResponse.json({ error: "Invalid message or conversation history" }, { status: 400 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Set GEMINI_API_KEY on the server to enable the admin assistant." }, { status: 503 });
  try {
    let snapshot = "No database snapshot was requested. Do not claim current operational counts.";
    if (body.includeSnapshot) {
      const counts = await prisma.booking.groupBy({ by: ["status"], _count: { _all: true } });
      snapshot = `Snapshot fetched at ${new Date().toISOString()}. All-time booking counts by status (no personal records): ${JSON.stringify(counts.map(row => ({ status: row.status, count: row._count._all })))}`;
    }
    const model = process.env.GEMINI_ADMIN_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(30000), cache: "no-store",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${ADMIN_AI_INSTRUCTIONS}\n${snapshot}` }] },
        contents: [...body.history.map(message => ({ role: message.role, parts: [{ text: message.content }] })), { role: "user", parts: [{ text: body.message }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "Gemini quota reached. Please retry later." : "Gemini is unavailable. Check the server API key and configured model." }, { status: response.status === 429 ? 429 : 502 });
    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts as { text?: string; thought?: boolean }[] | undefined;
    const reply = parts?.filter(part => !part.thought).map(part => part.text || "").join("").trim();
    if (!reply) return NextResponse.json({ error: "Gemini returned no answer. Please rephrase your question." }, { status: 502 });
    return NextResponse.json({ reply, snapshotIncluded: body.includeSnapshot }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Assistant request failed or timed out. Please try again." }, { status: 503 });
  }
}
