import { NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Booking references look like PREFIX-YYMMDD-XXXXXX (e.g., DROPFLY-250815-K7M3XQ).
// The random suffix never contains 0 or 1 (see src/lib/reference.ts).
const BOOKING_REFERENCE_PATTERN = /\b[A-Z]{2,12}-\d{6}-[A-Z2-9]{6}\b/g;

const SYSTEM_PROMPT = `You are an AI assistant for Dropnfly, an on-demand luggage storage and delivery service based in Metro Manila, Philippines. Your role is to help potential customers understand the service, answer questions, and guide them through booking.

KEY INFORMATION:
- Dropnfly offers pickup, storage, and delivery of luggage
- No registration required to book a pickup
- Customers can schedule a pickup online and have their bags delivered to their destination
- Real-time GPS tracking available for all bookings
- QR code access for instant status updates
- Secure, insured storage facilities with 24/7 monitoring
- 24/7 customer support
- Currently serving 12 cities across the Philippines
- Contact: hello@dropnfly.ph, +63 (2) 8123 4567
- Located in Metro Manila, Philippines

HOW TO HELP USERS:
- Guide them to /book to schedule a pickup
- Guide them to /track to track existing luggage
- Explain the simple 3-step process: 1) Book a pickup, 2) We handle and store it, 3) Delivered to destination
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
- For complex inquiries, direct users to contact hello@dropnfly.ph or call +63 (2) 8123 4567`;

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
    const text = String(message).toLowerCase();
    let reply = "I can help with booking, tracking, luggage storage, and delivery. For a live conversation, share your DROPFLY booking reference.";
    const reference = String(message).toUpperCase().match(BOOKING_REFERENCE_PATTERN)?.[0];
    if (reference) reply = `Thanks! I found your booking reference ${reference}. You can track it anytime at /track/${reference} — the live map and status timeline work even in demo mode.`;
    else if (text.includes("book")) reply = "You can create a test booking at /book. Online payment is optional in demo mode, so you can complete the full booking flow without PayMongo.";
    else if (text.includes("track") || text.includes("where")) reply = "Open /track and enter your DROPFLY reference. The demo map and status timeline work even when Mapbox is not configured.";
    else if (text.includes("price") || text.includes("cost")) reply = "Pricing depends on luggage size, storage duration, and pickup or delivery services. The booking form calculates the exact total before confirmation.";
    else if (text.includes("human") || text.includes("agent") || text.includes("staff")) reply = "Enter your booking reference and I’ll direct you to the booking chat monitored by the assigned employee and administrators.";
    return NextResponse.json({ reply, mode: "demo" });
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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
      const err = await res.text();
      if (process.env.NODE_ENV === "development") {
        console.error("Gemini API error:", res.status, err);
      }
      return NextResponse.json(
        { error: "Failed to generate response. Please try again." },
        { status: 500 }
      );
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
