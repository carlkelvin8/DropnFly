const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

interface PredictionResult {
  label: string;
  value: number;
  confidence: number;
}

interface PredictionResponse {
  predictions: PredictionResult[];
  insights: string[];
  generatedAt: string;
}

async function queryGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function generatePredictions(
  analyticsData: Record<string, unknown>
): Promise<PredictionResponse> {
  const prompt = `You are an AI analytics assistant for a luggage storage business called Dropnfly. Analyze this data and provide predictions and insights.

DATA:
${JSON.stringify(analyticsData, null, 2)}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "predictions": [
    { "label": "Expected bookings next 7 days", "value": <number>, "confidence": <0-100> },
    { "label": "Expected bookings next 30 days", "value": <number>, "confidence": <0-100> },
    { "label": "Peak booking hour", "value": <number 0-23>, "confidence": <0-100> },
    { "label": "Peak booking day of week", "value": <number 0-6>, "confidence": <0-100> },
    { "label": "Storage capacity needed (next 30d %)", "value": <number 0-100>, "confidence": <0-100> },
    { "label": "Employee workload (avg bookings per employee next 30d)", "value": <number>, "confidence": <0-100> }
  ],
  "insights": [
    "<insight about booking trends>",
    "<insight about revenue>",
    "<insight about customer behavior>",
    "<insight about operational efficiency>"
  ]
}

Keep predictions realistic based on the data. Values must be numbers.`;

  try {
    const raw = await queryGemini(prompt);
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      predictions: parsed.predictions || [],
      insights: parsed.insights || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prediction failed";
    throw new Error(message);
  }
}
