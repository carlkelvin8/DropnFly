import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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
- For complex inquiries, direct users to contact hello@dropnfly.ph or call +63 (2) 8123 4567`;

export async function POST(req: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI assistant is currently unavailable. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Understood. I am the Dropnfly AI assistant ready to help customers with their luggage storage and delivery needs." }] },
      ...(history || []).flatMap((h: { role: string; content: string }) => [
        { role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] },
      ]),
      { role: "user", parts: [{ text: message }] },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      console.error("Gemini API error:", res.status, err);
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
