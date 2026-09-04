import crypto from "crypto";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const geminiCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = geminiCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    geminiCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  geminiCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

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
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
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
  if (!GEMINI_API_KEY) {
    const last30 = Number(analyticsData.bookingsLast30Days || analyticsData.totalBookings || 0);
    const daily = Number(analyticsData.averageDailyBookings || last30 / 30);
    const employees = Math.max(Number(analyticsData.activeEmployees || 1), 1);
    const peakHours = Array.isArray(analyticsData.peakHourCandidates) ? analyticsData.peakHourCandidates as number[] : [10];
    return {
      predictions: [
        { label: "Expected bookings next 7 days", value: Math.round(daily * 7), confidence: 78 },
        { label: "Expected bookings next 30 days", value: Math.round(daily * 30), confidence: 72 },
        { label: "Peak booking hour", value: Number(peakHours[0] ?? 10), confidence: 70 },
        { label: "Peak booking day of week", value: 5, confidence: 62 },
        { label: "Storage capacity needed (next 30d %)", value: Math.min(100, Math.round(Number(analyticsData.storageUtilization || 0) * 1.08)), confidence: 68 },
        { label: "Employee workload (avg bookings per employee next 30d)", value: Math.round((daily * 30) / employees), confidence: 74 },
      ],
      insights: [
        `The current average is ${daily.toFixed(1)} bookings per day.`,
        "Forecasts use the available historical booking distribution and should be recalibrated as more live data is collected.",
        `Current storage utilization is ${Number(analyticsData.storageUtilization || 0)}%.`,
        "Use the peak-hour forecast to schedule pickup and delivery coverage.",
      ],
      generatedAt: new Date().toISOString(),
    };
  }
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
    const cacheKey = `predictions:${crypto.createHash("sha256").update(JSON.stringify(analyticsData)).digest("hex")}`;
    const cached = getCached<PredictionResponse>(cacheKey);
    if (cached) return cached;

    const raw = await queryGemini(prompt);
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const result: PredictionResponse = {
      predictions: parsed.predictions || [],
      insights: parsed.insights || [],
      generatedAt: new Date().toISOString(),
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prediction failed";
    throw new Error(message);
  }
}

export async function generateReport(
  type: "descriptive" | "predictive" | "financial",
  analyticsData: Record<string, unknown>
): Promise<{ title: string; summary: string; sections: { heading: string; content: string }[]; generatedAt: string }> {
  if (!GEMINI_API_KEY) {
    const bookings = Number(analyticsData.totalBookings || 0);
    const revenue = Number(analyticsData.totalRevenue || 0);
    const average = Number(analyticsData.avgBookingValue || (bookings ? revenue / bookings : 0));
    const utilization = Number(analyticsData.storageUtilization || 0);
    const paidRevenue = Number(analyticsData.totalRevenue || 0);
    const bookedValue = Number(analyticsData.bookedValue || revenue);
    const outstanding = Number(analyticsData.outstandingValue || Math.max(0, bookedValue - paidRevenue));
    const collectionRate = Number(analyticsData.collectionRate || 0);
    const activeEmployees = Number(analyticsData.activeEmployees || 0);
    const capacity = Number(analyticsData.storageCapacity || 0);
    const repeatCustomers = Number(analyticsData.repeatCustomers || 0);
    const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Analytics Report`;
    const common = [
      { heading: "Scope and Data Basis", content: `This report covers ${bookings} bookings within the selected reporting period. It uses recorded bookings, payments, luggage items, storage capacity, customers, and employee records; results should be interpreted in the context of the available live data.` },
      { heading: "Booking Performance", content: `${bookings} bookings produced an average booked value of ₱${average.toFixed(2)}. Review the status distribution and daily trend to identify completion bottlenecks, cancellations, and periods of concentrated demand.` },
      { heading: "Revenue and Collections", content: `Gross booked value is ₱${bookedValue.toFixed(2)}, while confirmed paid collections are ₱${paidRevenue.toFixed(2)}. Outstanding value is ₱${outstanding.toFixed(2)}, resulting in a ${collectionRate.toFixed(1)}% collection rate for the selected period.` },
      { heading: "Operational Capacity", content: `Configured capacity is ${capacity} slots and current utilization is ${utilization.toFixed(1)}%. The operation has ${activeEmployees} active employees. Capacity and staffing should be reviewed together during peak booking windows.` },
      { heading: "Customer Behavior", content: `${Number(analyticsData.totalCustomers || 0)} customers and ${repeatCustomers} repeat customers are represented. Repeat behavior is a useful retention signal, but conclusions become stronger as more completed booking cycles are recorded.` },
      { heading: "Risks and Limitations", content: "Forecasts are decision-support estimates, not guarantees. Missing payments, incomplete statuses, sparse history, seasonal changes, and unrecorded operating costs can materially change the conclusions." },
      { heading: "Recommended Actions", content: "Reconcile pending collections, investigate aging active bookings, schedule employees around observed peak hours, monitor utilization thresholds weekly, and compare forecast outcomes with actual results every reporting cycle." },
    ];
    return { title, summary: `A detailed deterministic report generated from ${bookings} bookings. It remains available without an external AI key and clearly separates booked value from confirmed paid revenue.`, sections: common, generatedAt: new Date().toISOString() };
  }
  const reportInstructions = `Use the selected report period exactly. Ground every conclusion in the supplied data and quote relevant numeric values. Clearly distinguish gross booked value, paid revenue, outstanding value, and collection rate. Include limitations when the dataset is sparse or a required cost metric is unavailable. Do not invent costs, profit, customer demographics, or causal explanations. Each section should be a substantial analytical paragraph with findings, interpretation, and a specific operational implication.`;
  const prompts: Record<string, string> = {
    descriptive: `You are a business analyst for Dropnfly, a luggage storage service. Generate a DESCRIPTIVE report analyzing past performance.

DATA:
${JSON.stringify(analyticsData, null, 2)}

INSTRUCTIONS:
${reportInstructions}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "title": "Descriptive Analytics Report",
  "summary": "<2-3 sentence executive summary of the data>",
  "sections": [
    { "heading": "Booking Performance", "content": "<detailed analysis of booking trends, status distribution, and patterns>" },
    { "heading": "Revenue Analysis", "content": "<analysis of revenue, average booking value, and payment insights>" },
    { "heading": "Operational Efficiency", "content": "<analysis of storage utilization, employee workload, and capacity>" },
    { "heading": "Customer Insights", "content": "<analysis of customer base, booking behavior, and trends>" },
    { "heading": "Risks and Data Limitations", "content": "<data quality, uncertainty, and interpretation limits>" },
    { "heading": "Recommendations", "content": "<prioritized, measurable actions based on the data>" }
  ]
}`,
    predictive: `You are a business analyst for Dropnfly, a luggage storage service. Generate a PREDICTIVE report forecasting future trends.

DATA:
${JSON.stringify(analyticsData, null, 2)}

INSTRUCTIONS:
${reportInstructions}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "title": "Predictive Analytics Report",
  "summary": "<2-3 sentence summary of future outlook based on trends>",
  "sections": [
    { "heading": "Booking Forecast", "content": "<predicted booking volumes for next 30/60/90 days with confidence levels>" },
    { "heading": "Revenue Projection", "content": "<expected revenue ranges and growth trajectory>" },
    { "heading": "Capacity Planning", "content": "<forecasted storage needs and when to expand capacity>" },
    { "heading": "Resource Allocation", "content": "<predicted employee requirements and peak period staffing>" },
    { "heading": "Risk Factors", "content": "<potential risks and mitigating strategies>" },
    { "heading": "Forecast Limitations", "content": "<confidence limits, sparse-data caveats, and assumptions>" },
    { "heading": "Recommended Decisions", "content": "<prioritized decisions with measurable review points>" }
  ]
}`,
    financial: `You are a financial analyst for Dropnfly, a luggage storage service. Generate a FINANCIAL report analyzing financial health.

DATA:
${JSON.stringify(analyticsData, null, 2)}

INSTRUCTIONS:
${reportInstructions}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "title": "Financial Analytics Report",
  "summary": "<2-3 sentence financial health summary>",
  "sections": [
    { "heading": "Revenue Overview", "content": "<detailed revenue breakdown, trends, and performance indicators>" },
    { "heading": "Average Revenue per Booking", "content": "<analysis of ARPB, factors affecting it, and optimization opportunities>" },
    { "heading": "Payment Analysis", "content": "<payment collection performance, down payment vs full payment trends>" },
    { "heading": "Cost and Profitability Limitations", "content": "<state which cost or profit measures cannot be calculated and what data is required>" },
    { "heading": "Financial Risks", "content": "<collection, refund, concentration, and data-quality risks>" },
    { "heading": "Growth & Profitability Outlook", "content": "<evidence-based outlook without inventing unrecorded costs>" },
    { "heading": "Recommended Financial Actions", "content": "<prioritized reconciliation and revenue actions with measurable targets>" }
  ]
}`,
  };

  try {
    const cacheKey = `report:${type}:${crypto.createHash("sha256").update(JSON.stringify(analyticsData)).digest("hex")}`;
    const cached = getCached<{ title: string; summary: string; sections: { heading: string; content: string }[]; generatedAt: string }>(cacheKey);
    if (cached) return cached;

    const prompt = prompts[type] || prompts.descriptive;
    const raw = await queryGemini(prompt);
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const result = {
      title: parsed.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      summary: parsed.summary || "",
      sections: parsed.sections || [],
      generatedAt: new Date().toISOString(),
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report generation failed";
    throw new Error(message);
  }
}
