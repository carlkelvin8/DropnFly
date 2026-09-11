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

// ─────────────────────────────────────────────────────────────────────────────
// GROUPED REPORT STRUCTURE — per sir's feedback:
// Do NOT make every sub-content its own top-level section.
// Each main section aggregates its sub-details inside one rich paragraph.
// E.g., "Revenue by Service" contains Luggage Type, Storage Duration,
// Service Type, Booking Source as inline details — not 5 separate sections.
// ─────────────────────────────────────────────────────────────────────────────

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
  const paymentStatuses = (data.paymentsByStatus as { status: string; count: number; amount: number }[] | undefined) || [];
  const trends = (data.dailyTrend as { date: string; bookings: number; bookedValue: number }[] | undefined) || [];
  const humanStatus = (s: string) => s.toLowerCase().replace(/_/g, " ");
  const statusText = statuses.length ? statuses.map((row) => `${humanStatus(row.status)} ${row.count}`).join(", ") : "No status activity recorded";
  const busiest = trends.reduce<(typeof trends)[number] | null>((best, row) => !best || row.bookings > best.bookings ? row : best, null);
  const repeatRate = customers ? (repeats / customers) * 100 : 0;
  const forecast = (days: number) => Math.max(0, Math.round(daily * days));
  const projection = (days: number) => forecast(days) * average;
  const periodLabel = (() => {
    const p = data.reportPeriod as { from?: string; to?: string } | undefined;
    if (p?.from && p?.to) return `${String(p.from).slice(0, 10)} to ${String(p.to).slice(0, 10)}`;
    return "selected period";
  })();

  const delivered = statuses.find((s) => s.status === "DELIVERED")?.count || 0;
  const cancelled = statuses.find((s) => s.status === "CANCELLED")?.count || 0;
  const pending = statuses.find((s) => s.status === "PENDING")?.count || 0;
  const inStorage = statuses.find((s) => s.status === "IN_STORAGE")?.count || 0;
  const totalPaidTx = paymentStatuses.find((row) => row.status === "PAID")?.count || 0;
  const refunds = Number((data as Record<string, unknown>).refundsAmount as number || 0);
  const refundCount = Number((data as Record<string, unknown>).refundsIssued as number || 0);

  if (type === "descriptive") {
    return {
      title: "Descriptive Analytics What Happened",
      summary: `In ${periodLabel} we recorded ${bookings} bookings worth ${money(booked)} and collected ${money(paid)} with a collection rate of ${collectionRate.toFixed(1)} percent and ${luggage} bags handled. This summary shows what actually happened in plain terms.`,
      sections: [
        { heading: "Report Information", content: `This is a descriptive report that explains what happened in ${periodLabel} using Manila time. It is based on real bookings, payments where paid status has a paid date, luggage and employee records. It was generated on ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. For a forecast see the predictive report and for money matters see the financial report.` },
        { heading: "Executive Summary", content: `We had ${bookings} bookings from ${customers} customers and ${repeats} of them returned which is ${repeatRate.toFixed(1)} percent. We handled ${luggage} bags. Booked value was ${money(booked)} and collected was ${money(paid)} with ${money(outstanding)} still outstanding. Average was ${money(average)} per booking. The busiest day was ${busiest ? `${busiest.date} with ${busiest.bookings} bookings worth ${money(busiest.bookedValue)}` : "not clear yet because data is still limited"}. Storage use is ${utilization.toFixed(1)} percent of ${capacity} capacity handled by ${employees} staff. This means ${utilization >= 80 ? "storage is getting tight" : utilization >= 50 ? "usage is moderate" : "there is still plenty of room"}.` },
        { heading: "Booking Performance", content: `Booking performance brings together total volume, trend and status in one view. Total booking volume is ${bookings} bookings and ${bookings - cancelled} without cancelled or no show. Delivered is ${delivered}, pending is ${pending}, in storage is ${inStorage} and cancelled is ${cancelled}. Remember that many bookings does not automatically mean high revenue. Booking trend covers ${trends.length} days. ${busiest ? `The peak was ${busiest.date} with ${busiest.bookings} bookings` : "There is no clear trend yet"} with an average of ${daily.toFixed(2)} per day. Compare this trend with staff and slot capacity before changing schedules. Booking status distribution is ${statusText}. Use this to find bottlenecks such as many confirmed not yet received or many in storage waiting for delivery.` },
        { heading: "Luggage and Storage Patterns", content: `This covers luggage type, storage duration and storage activity for ${luggage} items. Luggage type distribution is ${luggage} items. Check the baggage report for small or large mix to plan storage and vehicle load. Storage duration is measured from check in to check out. The average ${money(average)} already includes extra days for longer stays and longer stays make storage tighter so watch when it reaches 80 percent. Storage activity shows ${inStorage} bookings in storage which is ${utilization.toFixed(1)} percent of ${capacity || "unconfigured"} capacity. ${capacity ? `${capacity - Math.round((utilization / 100) * capacity)} spaces still free so check weekly.` : "Capacity is not configured so set max simultaneous bags in settings."}` },
        { heading: "Customer Activity", content: `Total customers is ${customers} unique people and each may have several bookings. New customers are ${customers - repeats} which is ${customers ? (((customers - repeats) / customers) * 100).toFixed(1) : "0.0"} percent. Compare new with returning to see if acquisition works. Repeat customers are ${repeats} which is ${repeatRate.toFixed(1)} percent in this period. Booking frequency is ${customers ? (bookings / customers).toFixed(2) : "0.00"} bookings per customer and ${daily.toFixed(2)} per day. If this is high it means trust is growing so adjust pickup windows accordingly.` },
        { heading: "Operational Activity", content: `Booking processing queue is ${statusText}. Start with the largest group especially pending ${pending} that needs a rider. Delivery activity covers out for delivery and delivered and ${delivered} were delivered in this period. Remember if vehicles are shared for pickup and delivery. Storage activity is ${inStorage} in storage at ${utilization.toFixed(1)} percent which matches the storage view above. Employee activity is ${employees} staff with about ${employees ? (bookings / employees).toFixed(1) : "0.0"} bookings per person in ${periodLabel}. Align schedules with the busiest days.` },
        { heading: "Historical Patterns and Observations", content: `${busiest ? `We observed the peak on ${busiest.date} with ${busiest.bookings} bookings.` : "There is no strong pattern yet because data is limited."} Return rate is ${repeatRate.toFixed(1)} percent and collection is ${collectionRate.toFixed(1)} percent. These are observations not forecasts.` },
        { heading: "Descriptive Findings", content: `In summary we had ${bookings} bookings, ${money(booked)} booked versus ${money(paid)} collected, ${luggage} bags, ${utilization.toFixed(1)} percent storage used and ${repeatRate.toFixed(1)} percent returned. Read this together with the length of the period because longer periods give clearer trends.` },
        { heading: "Data Limitations", content: `This is limited to events recorded in ${periodLabel}. Missing payments, incomplete status or activity outside the period can change the interpretation. Small samples increase uncertainty.` },
        { heading: "Descriptive Recommendations", content: `First clear the largest status queue. Second compare the busiest day with the staff roster. Third check if storage and staffing can handle ${utilization.toFixed(1)} percent. Fourth repeat the same metrics next period to see the trend.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  if (type === "financial") {
    return {
      title: "Financial Analytics What Happened to the Money",
      summary: `In ${periodLabel} we booked ${money(booked)}, collected ${money(paid)} and still have ${money(outstanding)} outstanding with a collection rate of ${collectionRate.toFixed(1)} percent and an average of ${money(average)} per booking.`,
      sections: [
        { heading: "Report Information", content: `This is a financial report for ${periodLabel} in Manila time. It is based on real bookings and payments where paid means it has a paid date. It was generated on ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. A payment counts only when verified with a paid date.` },
        { heading: "Financial Executive Summary", content: `We booked ${money(booked)} and collected ${money(paid)} leaving ${money(outstanding)} outstanding. That is a collection rate of ${collectionRate.toFixed(1)} percent. Average booked is ${money(average)} and average paid is ${money(averagePaid)}. Note that booked amount is not profit because costs are not recorded yet.` },
        { heading: "Revenue Analysis", content: `Revenue analysis brings together gross booked value, collected revenue, trend and average. Gross booked value is ${money(booked)} from ${bookings - cancelled} valid bookings without cancelled or no show. This is the amount billed, not yet cash on hand. Collected revenue is ${money(paid)} from ${totalPaidTx} payments with a paid date. This is the only sure cash to use for collection reporting. Revenue trend covers ${trends.length} days. ${busiest ? `The highest revenue day was ${busiest.date} with ${money(busiest.bookedValue)}` : "There is no clear revenue trend yet"}. Average is ${money(average)} per booking. Compare this with busy operational days. Average booking value is booked ${money(average)} versus paid ${money(averagePaid)}. Large bookings can pull the average up so check them before changing prices.` },
        { heading: "Collection Analysis", content: `Total collected is ${money(paid)} verified with a paid date and this is the real cash. Total outstanding is ${money(outstanding)} which is booked ${money(booked)} minus collected ${money(paid)} and this is still collectible. Collection rate is ${collectionRate.toFixed(1)} percent. If it is low, follow up is needed. Fully paid means paid is at least the booked amount, partially paid means some was paid but not enough which adds to ${money(outstanding)}, and unpaid means no paid payment yet. To know exact counts you need per booking reconciliation but the total ${money(paid)} shows how much is fully paid. Prioritize large and old balances.` },
        { heading: "Accounts Receivable / Outstanding Balance", content: `Total outstanding is ${money(outstanding)}. Outstanding by booking is the booked minus paid per booking and the total is ${money(outstanding)} so start with the largest. Outstanding by customer aggregates across ${customers} customers and repeating customers may have two balances so group per customer for outreach. Aging should be split into less than seven days, seven to thirty, and more than thirty. We do not have per booking details yet but build it from paid date versus created date and bucket the total ${money(outstanding)}.` },
        { heading: "Refund and Cancellation Financial Impact", content: `Total refunds are ${refundCount} transactions. Refund rate is ${bookings ? ((refundCount / bookings) * 100).toFixed(2) : "0.00"} percent. Compare it with cancellation rate ${bookings ? ((cancelled / bookings) * 100).toFixed(2) : "0.00"} percent. Refund amount is ${refunds ? money(refunds) : money(0)} and should be reconciled with provider settlement. Cancellations are ${cancelled} bookings removed from revenue. Booked ${money(booked)} excludes cancelled and no show. Find out why cancellations happen to reduce loss.` },
        { heading: "Revenue by Service", content: `This groups revenue by luggage type, storage duration, service type and booking source in one section. Revenue by luggage type depends on luggage size times storage days and total booked ${money(booked)} already includes the mix so check the baggage report for the exact split. Revenue by storage duration grows with longer stays and the average ${money(average)} already reflects that so review it together with utilization. Revenue by service type adds pickup and delivery fees to luggage and needs summing of services in luggage details. Revenue by booking source for walk in versus online is not stored per booking because there is no source field so add one if needed.` },
        { heading: "Profitability Analysis", content: `We cannot say if there is profit yet. Total and operating expenses are not recorded because there is no expense table so add a ledger of costs. Net income and profit margin cannot be calculated from ${money(booked)} alone and the collection rate of ${collectionRate.toFixed(1)} percent is not a margin. So there are no profitability numbers until costs are added for ${periodLabel}.` },
        { heading: "Financial Findings", content: `We booked ${money(booked)}, collected ${money(paid)} and left ${money(outstanding)} outstanding at ${collectionRate.toFixed(1)} percent. Refunds are ${refundCount} and cancelled are ${cancelled}. Collections are the verified cash.` },
        { heading: "Financial Recommendations", content: `First list every outstanding balance per booking and customer. Second age the receivables and start with those over thirty days. Third match payments with settlements and investigate refunds. Fourth add expense tracking before reporting profit.` },
        { heading: "Financial Limitations and Methodology", content: `Method is Manila time for the period, paid only when it has a paid date, gross booked without cancelled and no show, outstanding is booked minus collected. No profit is shown without costs and this is based on live bookings and payments.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  // predictive
  return {
    title: "Predictive Analytics What Is Likely to Happen",
    summary: `For ${periodLabel} at ${daily.toFixed(2)} per day we expect ${forecast(7)} bookings in 7 days and ${forecast(30)} in 30 days with a booked value of ${money(projection(30))} and 60 days forecast is ${forecast(60)} bookings. This is a guide not a promise.`,
    sections: [
      { heading: "Report Information", content: `This is a predictive report for ${periodLabel} in Manila time. It is based on the current run rate of ${daily.toFixed(2)} per day and an average of ${money(average)}. It was generated on ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.` },
      { heading: "Forecast Executive Summary", content: `We expect ${forecast(7)} bookings in 7 days, ${forecast(30)} in 30 days, ${forecast(60)} in 60 days and ${forecast(90)} in 90 days. If the average is ${money(average)}, that is about ${money(projection(30))} in 30 days. Storage is at ${utilization.toFixed(1)} percent of ${capacity} capacity with ${employees} staff. When history is short, forecasts are less reliable.` },
      { heading: "Demand Forecast", content: `Demand forecast is based on ${daily.toFixed(2)} per day. 7-Day Forecast is ${forecast(7)} bookings worth ${money(projection(7))} for weekly planning. 30-Day Forecast is ${forecast(30)} bookings worth ${money(projection(30))} and this is the main planning horizon. 60-Day Forecast is ${forecast(60)} bookings worth ${money(projection(60))} for medium term checks. 90-Day Forecast is ${forecast(90)} bookings worth ${money(projection(90))} for long term and it is less certain.` },
      { heading: "Future Revenue Forecast", content: `Expected booked value is ${money(projection(7))} in 7 days, ${money(projection(30))} in 30 days, ${money(projection(60))} in 60 days and ${money(projection(90))} in 90 days at an average of ${money(average)} without cancellations. At a collection rate of ${collectionRate.toFixed(1)} percent, about ${money(projection(30) * (collectionRate / 100))} would actually be collected in 30 days. Multiply the forecast by the collection rate.` },
      { heading: "Capacity Forecast", content: `Storage is at ${utilization.toFixed(1)} percent of ${capacity} bags. Expected storage demand is about ${forecast(30)} bookings in 30 days which means about ${forecast(30)} groups of bags at an average of ${(luggage / Math.max(1, bookings)).toFixed(1)} per booking. Compare this with capacity ${capacity}. Utilization is now ${utilization.toFixed(1)} percent and with ${forecast(30)} more bookings it will rise so check weekly especially at 80 percent. Bags in storage now are ${data.storageUsed as number || 0} and about ${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} more may arrive in 30 days. This is an estimate and daily occupancy is more accurate. Capacity pressure is ${utilization >= 80 ? "high so consider expansion" : utilization >= 50 ? "moderate so keep watching" : "low"} at ${utilization.toFixed(1)} percent and review at 80 percent.` },
      { heading: "Staffing / Workload Forecast", content: `We have ${employees} staff. Expected volume is ${forecast(7)} in 7 days, ${forecast(30)} in 30 days, ${forecast(60)} in 60 days and ${forecast(90)} in 90 days. Split this by pickup and delivery time. Luggage volume in 30 days is about ${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} items for vehicle planning. Workload is ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} bookings per person in 30 days so check peak hours before adding staff. For current productivity you need ${employees} staff for ${forecast(30)} bookings and add cover for peak day ${busiest ? busiest.date : "to be determined"}.` },
      { heading: "Peak Demand Prediction", content: `This is based on ${trends.length} days. High demand was observed on ${busiest ? `${busiest.date} with ${busiest.bookings} bookings` : "no clear peak because data is limited"} so expect similar weekdays and prepare cover. Low demand days have zero to one bookings and can be used for maintenance but confirm with longer history. Peak volume is about ${busiest ? busiest.bookings : Math.ceil(daily * 1.5)} bookings on a peak day and you should plan vehicle and counter capacity for it.` },
      { heading: "Future Luggage Demand", content: `Predicted demand by luggage type can be split from the current ${luggage} items and the baggage report shows small or large mix. Storage is at ${utilization.toFixed(1)} percent and may reach about ${Math.min(100, utilization + 5).toFixed(1)} percent in 30 days. This is an estimate so check capacity weekly.` },
      { heading: "Cancellation / No-Show Prediction", content: `${cancelled ? `We had ${cancelled} cancellations out of ${bookings} which is ${bookings ? ((cancelled / bookings) * 100).toFixed(1) : "0.0"} percent.` : "There is not enough cancellation history to predict."} ${bookings < 10 ? "Data is still limited so the forecast is uncertain." : "This can be used as a buffer for overbooking."} Remember we have ${bookings} bookings over ${trends.length} days at ${daily.toFixed(2)} per day and confidence is low when under 30 days or 20 bookings.` },
      { heading: "Forecast Confidence and Assumptions", content: `The forecast assumes demand, prices, hours and capacity stay the same with no holidays or campaigns. Confidence is 60 to 78 percent and lower for 60 and 90 days. Reforecast weekly and compare the 30 day forecast of ${forecast(30)} with the actual result next period.` },
      { heading: "Predictive Findings", content: `We expect ${forecast(30)} bookings worth ${money(projection(30))} in 30 days with ${utilization.toFixed(1)} percent storage and ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} per person and a peak on ${busiest ? busiest.date : "to be determined"}. This is a forecast not a guarantee.` },
      { heading: "Predictive Recommendations", content: `First assign staff for peak days. Second reforecast after price or capacity changes. Third check weekly when storage reaches 80 percent. Fourth track if the forecast matches reality.` },
      { heading: "Forecast Limitations and Methodology", content: `Method is Manila time for the period, run rate times average, paid only when it has a paid date. Booked is not collected. Small samples and missing external factors increase uncertainty. This is not financial advice.` },
    ],
    generatedAt: new Date().toISOString(),
    source: "deterministic",
  };
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

function cleanGeminiContent(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```json\s*/g, "").replace(/```/g, ""))
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__+/g, "")
    .replace(/•/g, "")
    .replace(/—/g, ", ")
    .trim();
}

function normalizeSections(
  sections: { heading?: unknown; content?: unknown }[] | undefined
): { heading: string; content: string }[] {
  if (!Array.isArray(sections)) return [];
  return sections
    .filter((s) => s && typeof s.heading === "string" && typeof s.content === "string")
    .map((s) => ({
      heading: String(s.heading).trim().replace(/\s+/g, " ").slice(0, 80),
      content: cleanGeminiContent(String(s.content))
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 4000),
    }))
    .filter((s) => s.heading.length > 0 && s.content.length > 20);
}

// GROUPED outline — main sections only, sub-details live inside content
const REQUIRED_HEADINGS: Record<string, string[]> = {
  descriptive: [
    "Report Information",
    "Executive Summary",
    "Booking Performance",
    "Luggage and Storage Patterns",
    "Customer Activity",
    "Operational Activity",
    "Historical Patterns and Observations",
    "Descriptive Findings",
    "Data Limitations",
    "Descriptive Recommendations",
  ],
  financial: [
    "Report Information",
    "Financial Executive Summary",
    "Revenue Analysis",
    "Collection Analysis",
    "Accounts Receivable / Outstanding Balance",
    "Refund and Cancellation Financial Impact",
    "Revenue by Service",
    "Profitability Analysis",
    "Financial Findings",
    "Financial Recommendations",
    "Financial Limitations and Methodology",
  ],
  predictive: [
    "Report Information",
    "Forecast Executive Summary",
    "Demand Forecast",
    "Future Revenue Forecast",
    "Capacity Forecast",
    "Staffing / Workload Forecast",
    "Peak Demand Prediction",
    "Future Luggage Demand",
    "Cancellation / No-Show Prediction",
    "Forecast Confidence and Assumptions",
    "Predictive Findings",
    "Predictive Recommendations",
    "Forecast Limitations and Methodology",
  ],
};

function isDistinctReport(
  parsed: { title?: unknown; summary?: unknown; sections?: unknown },
  type: "descriptive" | "predictive" | "financial"
): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const sections = parsed.sections as { heading?: unknown }[] | undefined;
  if (!Array.isArray(sections)) return false;
  const headings = sections.map((s) => String(s.heading || "").toLowerCase().trim());
  const required = REQUIRED_HEADINGS[type] || [];
  if (headings.length !== required.length) return false;
  if (required.some((heading, index) => headings[index] !== heading.toLowerCase())) return false;
  const forbidden: Record<string, string[]> = {
    descriptive: ["gross booked value", "expected booked value", "7-day forecast"],
    financial: ["booking performance", "7-day forecast", "luggage type distribution"],
    predictive: ["gross booked value", "booking performance", "total customers"],
  };
  const bad = (forbidden[type] || []).some((kw) => headings.some((h) => h.includes(kw) && !required.some((r) => r.toLowerCase().includes(kw))));
  // Extra check: financial must not explode "Revenue by Service" into separate top-level sections
  if (type === "financial" && headings.some((h) => ["revenue by luggage type", "revenue by storage duration", "revenue by service type", "revenue by booking source"].includes(h))) return false;
  if (bad) return false;
  return true;
}

export async function generateReport(
  type: "descriptive" | "predictive" | "financial",
  analyticsData: Record<string, unknown>
): Promise<AnalyticsReport> {
  if (!GEMINI_API_KEY) {
    return reportWithoutGemini(type, analyticsData);
  }
  const baseInstructions = `Use the selected report period exactly. Ground every conclusion in the supplied data and quote relevant numeric values. Clearly distinguish gross booked value, paid revenue, outstanding value, and collection rate. Include limitations when the dataset is sparse or a required cost metric is unavailable. Do not invent costs, profit, customer demographics, or causal explanations. Each main section is a single substantial analytical paragraph (4-6 sentences) in plain English that aggregates its sub-details in natural sentences — do NOT create separate sections for sub-contents and do NOT use bullet symbols or special characters. Example: "Revenue by Service" must cover Revenue by Luggage Type, Revenue by Storage Duration, Revenue by Service Type, and Revenue by Booking Source as plain sentences within that one section.

CRITICAL HUMAN TONE: Write like a real human operations manager talking to the owner — warm, simple, English only, easy to understand. Use short sentences, varied length, everyday words. Explain numbers as if teaching a new staff — no AI clichés like "In conclusion" or "It is important to note" or "As an AI", no code words like PENDING or CONFIRMED or IN_STORAGE or PAID with colon, no special characters like bullet, dash, star, hash, colon after status. Use plain English like "pending 11" and "confirmed 25" instead of "PENDING: 11". Use only plain English letters, numbers, commas and periods. Separate paragraphs with a blank line. You MUST use EXACTLY the headings listed for this report type — do not invent, omit, or rename them, and do not explode sub-contents into their own sections.`;
  const requiredList = REQUIRED_HEADINGS[type].map((h) => `"${h}"`).join(", ");
  const typeInstructions: Record<string, string> = {
    descriptive: `REPORT FOCUS: DESCRIPTIVE (What happened? — Bookings, customers, luggage, storage, operations, historical patterns). Use ONLY headings: ${requiredList}. Title must contain "Descriptive — What Happened?" and summary must describe past period results in plain English human words — e.g., "In this period we had X bookings...". Keep Booking Performance, Luggage and Storage Patterns, Customer Activity, and Operational Activity as grouped sections with sub-details inside as plain sentences, not as separate sections and not as bullets. English only, simple words, no special characters.`,
    predictive: `REPORT FOCUS: PREDICTIVE (What is likely to happen? — Future bookings, revenue, capacity, staffing, peak demand, future luggage). Use ONLY headings: ${requiredList}. Title must contain "Predictive — What Is Likely to Happen?" and summary must be future outlook with 7/30/60/90 days in plain English human words — e.g., "In the next 30 days we expect...". Keep Demand Forecast, Capacity Forecast, Staffing Forecast, and Peak Demand Prediction as grouped sections with sub-details inside as plain sentences. English only, no special characters.`,
    financial: `REPORT FOCUS: FINANCIAL (What happened to the money? — Booked value, revenue, collections, receivables, refunds, profitability). Use ONLY headings: ${requiredList}. Title must contain "Financial — What Happened to the Money?" and summary must center on collection rate and outstanding in plain English human words. CRITICAL: "Revenue by Service" is ONE section that must internally cover Revenue by Luggage Type, Revenue by Storage Duration, Revenue by Service Type, and Revenue by Booking Source as plain sentences — do NOT make those four separate sections. Similarly, Revenue Analysis, Collection Analysis, Accounts Receivable, Refund impact, and Profitability each group their sub-details inside as plain sentences. Do not analyze or group collections by payment channel or method. English only, no special characters or code words.`,
  };
  const prompts: Record<string, string> = {
    descriptive: `You are a business analyst for Dropnfly. Generate a DESCRIPTIVE report.

DATA:
${JSON.stringify(analyticsData, null, 2)}

INSTRUCTIONS:
${baseInstructions}
${typeInstructions.descriptive}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Descriptive Analytics — What Happened?",
  "summary": "<2-3 sentence past summary>",
  "sections": [${REQUIRED_HEADINGS.descriptive.map((h) => `{"heading":"${h}","content":"<analysis for ${h}>"}`).join(", ")}]
}`,
    predictive: `You are a business analyst for Dropnfly. Generate a PREDICTIVE report.

DATA:
${JSON.stringify(analyticsData, null, 2)}

INSTRUCTIONS:
${baseInstructions}
${typeInstructions.predictive}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Predictive Analytics — What Is Likely to Happen?",
  "summary": "<2-3 sentence future outlook>",
  "sections": [${REQUIRED_HEADINGS.predictive.map((h) => `{"heading":"${h}","content":"<forecast for ${h}>"}`).join(", ")}]
}`,
    financial: `You are a financial analyst for Dropnfly. Generate a FINANCIAL report.

DATA:
${JSON.stringify(analyticsData, null, 2)}

INSTRUCTIONS:
${baseInstructions}
${typeInstructions.financial}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Financial Analytics — What Happened to the Money?",
  "summary": "<2-3 sentence financial summary>",
  "sections": [${REQUIRED_HEADINGS.financial.map((h) => `{"heading":"${h}","content":"<financial analysis for ${h}>"}`).join(", ")}]
}`,
  };

  try {
    const cacheKey = `report:${type}:${crypto.createHash("sha256").update(JSON.stringify(analyticsData)).digest("hex")}`;
    const cached = getCached<AnalyticsReport>(cacheKey);
    if (cached) return cached;

    const prompt = prompts[type] || prompts.descriptive;
    const raw = await queryGemini(prompt);
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    const jsonSlice = jsonStart >= 0 && jsonEnd >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
    const parsed = JSON.parse(jsonSlice);

    const sections = normalizeSections(parsed.sections);
    const title = cleanGeminiContent(String(parsed.title || "")).slice(0, 120) || `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
    const summary = cleanGeminiContent(String(parsed.summary || "")).replace(/\s+/g, " ").trim().slice(0, 600);

    if (!isDistinctReport({ title, summary, sections }, type) || sections.length < 8) {
      console.warn(`[GEMINI] ${type} failed distinctness (got ${sections.length} sections), fallback deterministic`);
      const fallback = reportWithoutGemini(type, analyticsData);
      setCache(cacheKey, fallback);
      return fallback;
    }

    const summaryLower = summary.toLowerCase();
    const summaryOk =
      (type === "descriptive" && (summaryLower.includes("bookings") || summaryLower.includes("period"))) ||
      (type === "predictive" && (summaryLower.includes("30") || summaryLower.includes("forecast") || summaryLower.includes("expected"))) ||
      (type === "financial" && (summaryLower.includes("collection") || summaryLower.includes("outstanding") || summaryLower.includes("revenue")));
    if (!summaryOk) {
      console.warn(`[GEMINI] ${type} summary keyword fail, fallback`);
      const fallback = reportWithoutGemini(type, analyticsData);
      setCache(cacheKey, fallback);
      return fallback;
    }

    const result: AnalyticsReport = {
      title,
      summary,
      sections,
      generatedAt: new Date().toISOString(),
      source: "gemini" as const,
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[GEMINI] ${type} failed, deterministic:`, err instanceof Error ? err.message : err);
    return reportWithoutGemini(type, analyticsData);
  }
}
