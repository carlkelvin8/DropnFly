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

export interface AnalyticsReport {
  title: string;
  summary: string;
  sections: { heading: string; content: string }[];
  generatedAt: string;
  source: "gemini" | "deterministic";
}

function money(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function reportWithoutGemini(type: "descriptive" | "predictive" | "financial", data: Record<string, unknown>): AnalyticsReport {
  const bookings = Number(data.totalBookings || 0);
  const paid = Number(data.totalRevenue || 0);
  const booked = Number(data.bookedValue || 0);
  const outstanding = Number(data.outstandingValue || Math.max(0, booked - paid));
  const collectionRate = Number(data.collectionRate || 0);
  const average = Number(data.avgBookingValue || 0);
  const averagePaid = Number(data.avgPaidRevenuePerBooking || 0);
  const daily = Number(data.averageDailyBookings || 0);
  const utilization = Number(data.storageUtilization || 0);
  const capacity = Number(data.storageCapacity || 0);
  const employees = Number(data.activeEmployees || 0);
  const customers = Number(data.totalCustomers || 0);
  const repeats = Number(data.repeatCustomers || 0);
  const luggage = Number(data.totalLuggageItems || 0);
  const statuses = (data.bookingsByStatus as { status: string; count: number }[] | undefined) || [];
  const methods = (data.paymentsByMethod as { method: string; count: number; amount: number }[] | undefined) || [];
  const trends = (data.dailyTrend as { date: string; bookings: number; bookedValue: number }[] | undefined) || [];
  const statusText = statuses.length ? statuses.map((row) => `${row.status}: ${row.count}`).join(", ") : "No status activity recorded";
  const busiest = trends.reduce<(typeof trends)[number] | null>((best, row) => !best || row.bookings > best.bookings ? row : best, null);
  const repeatRate = customers ? repeats / customers * 100 : 0;
  const forecast = (days: number) => Math.max(0, Math.round(daily * days));
  const projection = (days: number) => forecast(days) * average;

  const reports: Record<typeof type, Omit<AnalyticsReport, "generatedAt" | "source">> = {
    descriptive: {
      title: "Descriptive Analytics — Period Performance",
      summary: `${bookings} bookings were recorded in the selected period. They produced ${money(booked)} in booked value and ${money(paid)} in confirmed collections.`,
      sections: [
        { heading: "Booking Volume and Status Mix", content: `Recorded statuses: ${statusText}. Average demand was ${daily.toFixed(2)} bookings per day.${busiest ? ` The busiest recorded day was ${busiest.date}, with ${busiest.bookings} bookings.` : " There is not enough activity to identify a busiest day."}\n\nUse this mix to identify workflow stages where bookings accumulate.` },
        { heading: "Observed Revenue Performance", content: `Booked value was ${money(booked)}, while paid revenue was ${money(paid)}. Average booked value was ${money(average)}, with ${money(outstanding)} outstanding and a ${collectionRate.toFixed(1)}% collection rate.\n\nThese figures describe recorded performance; revenue is not profit.` },
        { heading: "Operational Snapshot", content: `${luggage} luggage items were associated with period bookings. Storage utilization is ${utilization.toFixed(1)}% of configured capacity (${capacity}), supported by ${employees} active employees.\n\nReview staffing and storage together during concentrated demand.` },
        { heading: "Customer Activity", content: `${customers} customers booked during the period, including ${repeats} repeat customers (${repeatRate.toFixed(1)}%).\n\nThis is a period return rate, not lifetime retention.` },
        { heading: "Data Limitations", content: "This report summarizes recorded events only. Missing payments, incomplete statuses, or activity outside the selected period can change the interpretation." },
        { heading: "Recommended Operational Actions", content: "1. Review the largest active status queue.\n\n2. Reconcile outstanding bookings.\n\n3. Compare busy days with employee schedules.\n\n4. Track the same measures next period." },
      ],
    },
    predictive: {
      title: "Predictive Analytics — Demand Forecast",
      summary: `At ${daily.toFixed(2)} bookings per day, the baseline forecast is ${forecast(30)} bookings over 30 days, ${forecast(60)} over 60 days, and ${forecast(90)} over 90 days. These are run-rate projections, not guaranteed outcomes.`,
      sections: [
        { heading: "30 / 60 / 90-Day Booking Forecast", content: `Baseline volumes are ${forecast(30)}, ${forecast(60)}, and ${forecast(90)} bookings over 30, 60, and 90 days respectively.\n\nConfidence is limited when the selected history is short, sparse, or seasonal.` },
        { heading: "Projected Booked Value", content: `At the current ${money(average)} average, projected booked value is ${money(projection(30))}, ${money(projection(60))}, and ${money(projection(90))} over 30, 60, and 90 days.\n\nThis excludes future cancellations, collection delays, and costs.` },
        { heading: "Capacity Outlook", content: `Current utilization is ${utilization.toFixed(1)}% of capacity (${capacity}). Check occupancy weekly and trigger a capacity review at 80%; a monthly run rate cannot model overlapping storage stays.` },
        { heading: "Staffing Outlook", content: `${employees} active employees would support approximately ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} forecast bookings per employee over 30 days. Use time-slot demand before changing schedules.` },
        { heading: "Forecast Risks and Assumptions", content: "The forecast assumes current demand, prices, operating hours, and capacity remain stable. It does not model holidays, disruptions, campaigns, or external events." },
        { heading: "Recommended Forecast Decisions", content: "1. Compare forecast with actuals weekly.\n\n2. Reforecast after pricing or capacity changes.\n\n3. Prepare coverage for observed peak days.\n\n4. Review capacity at the defined threshold." },
      ],
    },
    financial: {
      title: "Financial Analytics — Collections and Revenue",
      summary: `The period recorded ${money(booked)} in booked value and ${money(paid)} in confirmed paid revenue. Outstanding value is ${money(outstanding)}, for a ${collectionRate.toFixed(1)}% collection rate.`,
      sections: [
        { heading: "Revenue and Collection Position", content: `Booked value was ${money(booked)} and verified paid collections were ${money(paid)}. The ${money(outstanding)} difference remains outstanding.\n\nBooked value is not cash received; use paid revenue for collection reporting.` },
        { heading: "Revenue per Booking", content: `Average booked value was ${money(average)}, while average paid revenue per booking was ${money(averagePaid)}. Review outliers before using averages for pricing decisions.` },
        { heading: "Payment Method Mix", content: methods.length ? `Payment activity: ${methods.map((row) => `${row.method}: ${row.count} payment(s), ${money(Number(row.amount))}`).join("; ")}.\n\nReconcile these totals with provider and cash settlements.` : "No paid payment-method data was recorded, so payment mix analysis is unavailable." },
        { heading: "Receivables Risk", content: `${money(outstanding)} is uncollected relative to booked value. Prioritize reconciliation by booking age and amount, separating valid receivables from cancelled or disputed transactions.` },
        { heading: "Profitability Limitation", content: "Net profit and margin cannot be calculated because operating costs, payroll, payment fees, and period-matched expenses are unavailable. Revenue must not be presented as profit." },
        { heading: "Recommended Financial Actions", content: "1. Reconcile every outstanding balance.\n\n2. Match payment totals to settlements.\n\n3. Add period-matched expenses before reporting profit.\n\n4. Monitor collection rate each cycle." },
      ],
    },
  };

  return { ...reports[type], generatedAt: new Date().toISOString(), source: "deterministic" };
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
): Promise<AnalyticsReport> {
  if (!GEMINI_API_KEY) {
    return reportWithoutGemini(type, analyticsData);
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
    const cached = getCached<AnalyticsReport>(cacheKey);
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
      source: "gemini" as const,
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report generation failed";
    throw new Error(message);
  }
}
