import { NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Booking references look like PREFIX-YYMMDD-XXXXXX (e.g., DROPFLY-250815-K7M3XQ).
// The random suffix never contains 0 or 1 (see src/lib/reference.ts).
const BOOKING_REFERENCE_PATTERN = /\b[A-Z]{2,12}-\d{6}-[A-Z2-9]{6}\b/g;

const SYSTEM_PROMPT = `You are the customer-facing AI FAQ assistant for Dropnfly Logistics Inc., a luggage storage, pickup, and delivery service serving NAIA Terminals 1-4 and its Dropnfly counter in Villamor, Pasay City. Help customers understand the service and use the current website workflows.

KEY INFORMATION:
- Dropnfly offers pickup, storage, and delivery of luggage
- Customers can create a booking online and receive a booking reference and QR code
- Pickup and delivery are optional services selected during booking
- Live rider GPS becomes available after the assigned employee starts the active pickup or delivery task
- Customers can use /track with their booking reference for status, verification photos, timeline, map, and booking chat
- Secure, insured storage facilities with 24/7 monitoring
- 24/7 customer support
- Service locations and fees shown in the booking form are the source of truth
- Do not invent contact details; direct customers to the website footer or live support when contact details are requested

HOW TO HELP USERS:
- Guide them to /book to schedule a pickup
- Guide them to /track to track existing luggage
- Explain the flow: create a booking, present the reference/QR for luggage processing, follow status and proof in /track, then receive or collect luggage according to the selected service
- Answer questions about pricing, coverage areas, security, and service hours

CONVERSATION RULES:
- Be friendly, helpful, and enthusiastic
- Keep responses concise and conversational (2-4 sentences ideally)
- If asked about something outside Dropnfly's scope, politely redirect to Dropnfly services
- Never invent pricing — tell users pricing varies by location and to book for a quote
- Never make promises about specific delivery times — say it depends on location and availability
- Always use natural, conversational Filipino-English (Taglish) tone — warm and approachable
- Use "po" when appropriate for politeness
- Booking references follow the format PREFIX-YYMMDD-XXXXXX (e.g., DROPFLY-250815-K7M3XQ). If a customer shares one, direct them to /track/<reference> for live status and tracking.
- For account-specific, disputed, or complex inquiries, tell users to tap “Talk to an agent” in this chat. Do not claim to have accessed a booking or live database record.`;

function faqFallback(message: unknown): string {
  const raw = String(message || "");
  const text = raw.toLowerCase();
  const reference = raw.toUpperCase().match(BOOKING_REFERENCE_PATTERN)?.[0];
  if (reference) return `You can track booking ${reference} at /track/${reference} to view its latest status, photos, timeline, and available live map.`;
  if (text.includes("book")) return "Open /book to create a booking. The form shows the current luggage, service, schedule, and price options before confirmation.";
  if (text.includes("track") || text.includes("where")) return "Open /track and enter your booking reference. You can view the current status, verification photos, timeline, and live rider map once the assigned employee starts the task.";
  if (text.includes("price") || text.includes("cost")) return "Pricing depends on luggage size, storage duration, and pickup or delivery services. The booking form calculates the exact total before confirmation.";
  if (text.includes("tag") || text.includes("qr")) return "Your booking confirmation includes a reference and QR code. Staff assigns and verifies the physical baggage tag during the luggage handoff workflow.";
  if (text.includes("human") || text.includes("agent") || text.includes("staff")) return "Tap “Talk to an agent” to start a live support conversation; no booking is required.";
  return "I can help with booking, baggage tags, storage, pickup or delivery, and tracking. For account-specific help, tap “Talk to an agent.”";
}

export async function POST(req: Request) {
  const key = requestKey(req);
  const { allowed, retryAfter } = await rateLimit(`chat:${key}`, 10, 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before sending another message." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!GEMINI_API_KEY) {
    const { message = "" } = await req.json();
    return NextResponse.json({ reply: faqFallback(message), mode: "faq" });
  }

  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!Array.isArray(history) || history.length > 20) {
      return NextResponse.json({ error: "Invalid history" }, { status: 400 });
    }
    const sanitizedHistory = history.slice(-20).map((h: { role: string; content: string }) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: String(h.content || "").slice(0, 4000) }],
    }));

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Understood. I am the Dropnfly AI assistant ready to help customers with their luggage storage and delivery needs." }] },
      ...sanitizedHistory,
      { role: "user", parts: [{ text: message }] },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini API error:", res.status, res.statusText, "model:", GEMINI_MODEL);
      return NextResponse.json({ reply: faqFallback(message), mode: "faq-fallback" });
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || faqFallback(message);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Gemini chatbot request failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ reply: "I’m temporarily unable to reach the AI service. You can still ask about booking, tracking, pricing, or tap “Talk to an agent” for help.", mode: "faq-fallback" });
  }
}
