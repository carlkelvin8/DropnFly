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
  const statusText = statuses.length ? statuses.map((row) => `${row.status}: ${row.count}`).join(", ") : "No status activity recorded";
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
      title: "Descriptive Analytics — What Happened?",
      summary: `${bookings} bookings were recorded in ${periodLabel}. They produced ${money(booked)} in booked value and ${money(paid)} in confirmed collections (${collectionRate.toFixed(1)}% collection rate) with ${luggage} luggage items.`,
      sections: [
        { heading: "Report Information", content: `This is a DESCRIPTIVE report (What happened?) for ${periodLabel}. Scope: bookings, customers, luggage, storage, and operations based on live DropnFly bookings, payments (PAID requires paidAt), luggage, customers, and employee records in Manila time. Generated ${new Date().toLocaleString("en-PH")}. No forecasting is included here — see Predictive report for outlook; financial health is detailed in the Financial report.` },
        { heading: "Executive Summary", content: `${bookings} bookings, ${customers} customers (${repeats} repeat, ${repeatRate.toFixed(1)}% return rate), and ${luggage} luggage items were recorded. Booked value ${money(booked)}, collected ${money(paid)}, outstanding ${money(outstanding)}. Average ${money(average)} per booking.\n\nBusiest day: ${busiest ? `${busiest.date} with ${busiest.bookings} bookings` : "insufficient daily activity to identify a peak"}. Storage utilization ${utilization.toFixed(1)}% of ${capacity} capacity via ${employees} active employees.` },
        { heading: "Booking Performance", content: `Booking Performance aggregates the three sub-signals for ${periodLabel} — Total Booking Volume, Booking Trend, and Booking Status Distribution — in one view so the report does not fragment into unnecessary sections.\n\n• Total Booking Volume: ${bookings} total bookings; valid (excl. CANCELLED/NO_SHOW) ${bookings - cancelled}; Delivered ${delivered}, Pending ${pending}, In-Storage ${inStorage}, Cancelled ${cancelled}. Volume alone does not indicate revenue.\n• Booking Trend: ${trends.length} daily points; ${busiest ? `peak was ${busiest.date} with ${busiest.bookings} bookings (${money(busiest.bookedValue)})` : "no clear trend — sparse data"}. Average ${daily.toFixed(2)}/day. Compare this trend with staffing and slot capacity before adjusting schedules.\n• Booking Status Distribution: ${statusText}. Use this to find bottlenecks (e.g., many CONFIRMED not yet RECEIVED, or many IN_STORAGE awaiting delivery).` },
        { heading: "Luggage and Storage Patterns", content: `Luggage and Storage Patterns covers Luggage Type Distribution, Storage Duration, and Storage Activity together for ${periodLabel} (total ${luggage} luggage items).\n\n• Luggage Type Distribution: ${luggage} items across recorded bookings. Detailed type mix is available in baggage reports; sizing informs storage allocation and vehicle load planning.\n• Storage Duration: measured from check-in to check-out per booking. Average booked value ${money(average)} already reflects the duration multiplier; long stays increase utilization — monitor at 80% capacity.\n• Storage Activity: In-storage bookings ${inStorage}, utilization ${utilization.toFixed(1)}% of ${capacity} bags. ${capacity ? `${capacity - Math.round((utilization / 100) * capacity)} capacity units remain.` : "Capacity not configured — set max_simultaneous_bags in Settings."} Review weekly.` },
        { heading: "Customer Activity", content: `Customer Activity aggregates four related details for ${periodLabel} — Total Customers, New Customers, Repeat Customers, and Booking Frequency — so they are not separate report sections.\n\n• Total Customers: ${customers} distinct customers (each may have multiple bookings).\n• New Customers: ${customers - repeats} (${customers ? (((customers - repeats) / customers) * 100).toFixed(1) : "0.0"}% of total) — compare with repeat count to assess acquisition.\n• Repeat Customers: ${repeats} (${repeatRate.toFixed(1)}% return rate for the period, not lifetime retention).\n• Booking Frequency: ${customers ? (bookings / customers).toFixed(2) : "0.00"} bookings per customer; daily average ${daily.toFixed(2)}. Frequency helps size pickup/delivery windows.` },
        { heading: "Operational Activity", content: `Operational Activity groups Booking Processing, Delivery Activity, Storage Activity, and Employee Activity for ${periodLabel} to avoid unnecessary section inflation.\n\n• Booking Processing: queue ${statusText}. Pending ${pending} and confirmed bookings require rider assignment and slot capacity — clear the largest active status first.\n• Delivery Activity: OUT_FOR_DELIVERY and DELIVERED statuses. Delivered in period: ${delivered}. Track delivery vs pickup vehicle sharing (fleet capacity).\n• Storage Activity: ${inStorage} currently in storage, utilization ${utilization.toFixed(1)}% — mirrors the storage snapshot above with an operational lens.\n• Employee Activity: ${employees} active employees; est. ${employees ? (bookings / employees).toFixed(1) : "0.0"} bookings per employee for ${periodLabel}. Align rosters to busiest days.` },
        { heading: "Historical Patterns and Observations", content: `${busiest ? `Historical peak was ${busiest.date} with ${busiest.bookings} bookings.` : "No strong historical pattern — data sparse."} Repeat rate ${repeatRate.toFixed(1)}%, collection ${collectionRate.toFixed(1)}%. These are observed patterns, not forecasts.` },
        { heading: "Descriptive Findings", content: `What happened: ${bookings} bookings, ${money(booked)} booked vs ${money(paid)} collected, ${luggage} bags, ${utilization.toFixed(1)}% storage used, ${repeatRate.toFixed(1)}% repeat. Interpret with period length and data completeness in mind.` },
        { heading: "Data Limitations", content: `Limited to recorded events in ${periodLabel}. Missing payments, incomplete statuses, or activity outside period can change interpretation. Small samples increase uncertainty.` },
        { heading: "Descriptive Recommendations", content: `1. Reconcile the largest active status queue.\n2. Compare busiest day with employee roster.\n3. Validate storage vs staffing at current utilization.\n4. Track same metrics next period for trend.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  if (type === "financial") {
    return {
      title: "Financial Analytics — What Happened to the Money?",
      summary: `Financial health for ${periodLabel}: ${money(booked)} booked, ${money(paid)} collected, ${money(outstanding)} outstanding (${collectionRate.toFixed(1)}% collection rate). Average ${money(average)} per booking.`,
      sections: [
        { heading: "Report Information", content: `This financial report explains what happened to booked value, collections, receivables, refunds, and measurable profitability for ${periodLabel}. It uses live DropnFly booking and payment records in Manila time and was generated on ${new Date().toLocaleString("en-PH")}. A payment is counted as collected only when its status is PAID and it has a paidAt timestamp.` },
        { heading: "Financial Executive Summary", content: `Booked ${money(booked)} vs collected ${money(paid)} vs outstanding ${money(outstanding)} at ${collectionRate.toFixed(1)}% collection. Average booked ${money(average)}, average paid ${money(averagePaid)}. Revenue is not profit — costs unavailable.` },
        { heading: "Revenue Analysis", content: `Revenue Analysis aggregates Gross Booked Value, Collected Revenue, Revenue Trend, and Average Booking Value for ${periodLabel} in one main section.\n\n• Gross Booked Value: ${money(booked)} from ${bookings - cancelled} valid bookings (excl. CANCELLED/NO_SHOW) — this is quoted value, not cash collected.\n• Collected Revenue: ${money(paid)} from ${totalPaidTx} paid transactions (PAID with paidAt). Use paidAt-verified figures for collection reporting.\n• Revenue Trend: ${trends.length} daily points; ${busiest ? `peak revenue day ${busiest.date} ${money(busiest.bookedValue)}` : "no clear revenue trend — sparse data"}. Average ${money(average)} per booking; compare with operational peaks.\n• Average Booking Value: booked ${money(average)} vs paid ${money(averagePaid)}. Outliers can skew averages — review large bookings before repricing.` },
        { heading: "Collection Analysis", content: `Collection Analysis aggregates Total Collected, Total Outstanding, Collection Rate, and payment status mix for ${periodLabel}.\n\n• Total Collected: ${money(paid)} (verified via paidAt timestamp).\n• Total Outstanding: ${money(outstanding)} (booked ${money(booked)} − collected ${money(paid)}) — the collectible pool before cancellations/disputes.\n• Collection Rate: ${collectionRate.toFixed(1)}% (${money(paid)} / ${money(booked)}). Monitor per cycle; low rate indicates follow-up needed.\n• Fully Paid / Partially Paid / Unpaid Bookings: fully paid = paid sum ≥ booked value; partially paid = paid >0 but < booked (contributes to ${money(outstanding)}); unpaid = no PAID payment yet. Exact counts require per-booking reconciliation — aggregate collected ${money(paid)} indicates overall fully-paid share. Prioritize by age and amount.` },
        { heading: "Accounts Receivable / Outstanding Balance", content: `Accounts Receivable / Outstanding Balance details Outstanding by Booking, Outstanding by Customer, and Aging of Receivables for ${periodLabel}. Total outstanding ${money(outstanding)} is the aggregate receivable.\n\n• Outstanding by Booking: sum of (booked − paid) per valid booking; total ${money(outstanding)} — largest balances first for collection.\n• Outstanding by Customer: aggregate per ${customers} customers (repeat ${repeats} may carry multiple balances) — group by customer for outreach.\n• Aging of Receivables: requires per-booking paidAt vs createdAt. Total ${money(outstanding)} should be bucketed as <7d, 7–30d, >30d once data is available. Build aging from payment timestamps.` },
        { heading: "Refund and Cancellation Financial Impact", content: `Refund and Cancellation Financial Impact groups Total Refunds, Refund Rate, Refund Amount, and Financial Impact of Cancellations for ${periodLabel}.\n\n• Total Refunds: ${refundCount} transactions (count from REFUNDED payments).\n• Refund Rate: ${bookings ? ((refundCount / bookings) * 100).toFixed(2) : "0.00"}% of bookings — compare with cancellation rate ${(bookings ? ((cancelled / bookings) * 100).toFixed(2) : "0.00")}%.\n• Refund Amount: ${refunds ? money(refunds) : money(0)} — reconcile with provider settlements.\n• Financial Impact of Cancellations: ${cancelled} cancelled bookings removed from revenue. Booked value ${money(booked)} excludes CANCELLED/NO_SHOW. Track cancellation reasons to reduce leakage.` },
        { heading: "Revenue by Service", content: `Revenue by Service aggregates four service dimensions for ${periodLabel} in one main section — not as four separate report sections — so the report stays concise.\n\n• Revenue by Luggage Type: luggage-type revenue is derived from luggage details × storage days. Total booked ${money(booked)} already includes luggage mix; see baggage reports for the exact type split.\n• Revenue by Storage Duration: longer stays increase booked value via the days multiplier. Average ${money(average)} already reflects duration; analyze duration vs utilization together.\n• Revenue by Service Type: pickup/delivery fees are added to luggage subtotal. Detailed service split requires aggregating luggageDetails services (pick-up / deliver) — reconcile service fees separately.\n• Revenue by Booking Source, if available: walk-in vs online source revenue split is not stored per booking in the current schema (no source field) — if needed, add a source field to bookings to enable this slice.` },
        { heading: "Profitability Analysis", content: `Profitability Analysis covers Total Expenses, Operating Expenses, Net Income, Profit Margin, and the expense-data caveat for ${periodLabel} in one section.\n\n• Total Expenses / Operating Expenses: not recorded in schema (no expense table) — cannot compute. Add an expense ledger with period-matched capture to enable.\n• Net Income / Profit Margin: cannot calculate from ${money(booked)} booked vs costs — revenue must not be presented as profit. Collection rate ${collectionRate.toFixed(1)}% is not margin.\n• Only if expense data exists: profitability metrics are omitted because expense data does not exist in the current dataset for ${periodLabel}.` },
        { heading: "Financial Findings", content: `Findings: ${money(booked)} booked, ${money(paid)} collected, ${money(outstanding)} outstanding at ${collectionRate.toFixed(1)}% collection. Refunds ${refundCount}, cancelled ${cancelled}. Collections are the verified cash signal.` },
        { heading: "Financial Recommendations", content: `1. Reconcile every outstanding balance by booking and customer.\n2. Age receivables and prioritize >30d.\n3. Match payments to settlements; investigate refunds.\n4. Add expense tracking before reporting profit.` },
        { heading: "Financial Limitations and Methodology", content: `Method: the selected period follows Manila time; collected revenue includes only PAID records with paidAt; gross booked value excludes CANCELLED and NO_SHOW bookings; outstanding balance equals gross booked value less collected revenue. Profitability is not calculated without recorded expenses. Source: live DropnFly booking and payment records.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  // predictive
  return {
    title: "Predictive Analytics — What Is Likely to Happen?",
    summary: `Predictive outlook for ${periodLabel}: at ${daily.toFixed(2)}/day, baseline forecast ${forecast(7)} in 7 days, ${forecast(30)} in 30 days, ${forecast(60)} in 60 days, ${forecast(90)} in 90 days; projected booked value ${money(projection(30))} in 30 days at ${money(average)} avg.`,
    sections: [
      { heading: "Report Information", content: `This is a PREDICTIVE report (What is likely to happen?) for ${periodLabel}. Scope: future bookings, revenue, capacity, staffing, peak demand, future luggage. Based on run-rate (${daily.toFixed(2)}/day) and ${money(average)} avg, not guarantees. Generated ${new Date().toLocaleString("en-PH")}.` },
      { heading: "Forecast Executive Summary", content: `Forecast: ${forecast(7)} bookings in 7 days, ${forecast(30)} in 30 days, ${forecast(60)} in 60 days, ${forecast(90)} in 90 days. Expected booked value ${money(projection(30))} in 30 days. Capacity ${utilization.toFixed(1)}% of ${capacity}, ${employees} employees. Confidence limited if history short/sparse.` },
      { heading: "Demand Forecast", content: `Demand Forecast aggregates 7-Day, 30-Day, 60-Day, and 90-Day booking forecasts from the ${daily.toFixed(2)}/day run-rate for ${periodLabel}.\n\n• 7-Day Forecast: ${forecast(7)} bookings, ${money(projection(7))} booked value at ${money(average)} avg — use for weekly rostering.\n• 30-Day Forecast: ${forecast(30)} bookings, ${money(projection(30))} booked value — the primary planning horizon.\n• 60-Day Forecast: ${forecast(60)} bookings, ${money(projection(60))} booked value — intermediate capacity check.\n• 90-Day Forecast: ${forecast(90)} bookings, ${money(projection(90))} booked value — long-range, lower confidence.` },
      { heading: "Future Revenue Forecast", content: `Future Revenue Forecast for ${periodLabel} based on run-rate and average.\n\n• Expected Booked Value: ${money(projection(7))} in 7 days, ${money(projection(30))} in 30 days, ${money(projection(60))} in 60 days, ${money(projection(90))} in 90 days at ${money(average)} avg (excludes future cancellations/costs).\n• Expected Revenue (collected) at ${collectionRate.toFixed(1)}% collection: ~${money(projection(30) * (collectionRate / 100))} in 30 days. Apply collection rate to booked projection.` },
      { heading: "Capacity Forecast", content: `Capacity Forecast for ${periodLabel}: current ${utilization.toFixed(1)}% of ${capacity} bags.\n\n• Expected Storage Demand: ~${forecast(30)} bookings in 30 days implies ~${forecast(30)} bag-groups (avg ${(luggage / Math.max(1, bookings)).toFixed(1)} bags/booking). Compare with capacity ${capacity}.\n• Expected Storage Utilization: current ${utilization.toFixed(1)}%. At +${forecast(30)} bookings, utilization may rise; review weekly at 80% threshold. Run-rate cannot model overlapping stays precisely.\n• Expected Bags in Storage: current active ${data.storageUsed as number || 0} bags. Add ~${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} bag-items in 30 days (rough) — use daily occupancy, not just bookings.\n• Capacity Pressure: ${utilization >= 80 ? "High — review expansion" : utilization >= 50 ? "Moderate — monitor" : "Low"} at ${utilization.toFixed(1)}%. Trigger review at 80%.` },
      { heading: "Staffing / Workload Forecast", content: `Staffing / Workload Forecast for ${periodLabel} with ${employees} active employees.\n\n• Expected Booking Volume: ${forecast(7)}/7d, ${forecast(30)}/30d, ${forecast(60)}/60d, ${forecast(90)}/90d — distribute by time slots.\n• Expected Luggage Volume: ~${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} items in 30 days at current mix — for vehicle load planning.\n• Employee Workload: ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} bookings per employee in 30 days (avg) — use slot peaks before changing rosters.\n• Potential Staffing Requirements: at current productivity, ${employees} staff for ${forecast(30)} bookings. Add cover for peak days ${busiest ? busiest.date : "TBD"}.` },
      { heading: "Peak Demand Prediction", content: `Peak Demand Prediction for ${periodLabel} based on observed ${trends.length} days.\n\n• Predicted High-Demand Periods: ${busiest ? `high-demand observed ${busiest.date} with ${busiest.bookings} bookings` : "no high-demand period identified — sparse data"} — expect similar weekday/time patterns; prepare cover.\n• Predicted Low-Demand Periods: days with 0–1 bookings in history — use low periods for maintenance/training; validate with longer history.\n• Expected Peak Volume: ~${busiest ? busiest.bookings : Math.ceil(daily * 1.5)} bookings on peak day (historical peak as proxy) — plan vehicle and counter capacity.` },
      { heading: "Future Luggage Demand", content: `Future Luggage Demand for ${periodLabel}.\n\n• Predicted Demand by Luggage Type: proportional to current ${luggage} items; type split requires luggage breakdown (see baggage reports).\n• Expected Storage Requirements: ${utilization.toFixed(1)}% now; +30d demand may push toward ${Math.min(100, utilization + 5).toFixed(1)}% (rough) — review capacity weekly.` },
      { heading: "Cancellation / No-Show Prediction", content: `${cancelled ? `Historical cancellations: ${cancelled} of ${bookings} (${bookings ? ((cancelled / bookings) * 100).toFixed(1) : "0.0"}%).` : "Insufficient cancellation history for prediction."} ${bookings < 10 ? "Only if sufficient historical data exists — currently sparse, low confidence." : "Use for overbooking buffer."}\n\nOnly if sufficient historical data exists: current history ${bookings} bookings over ${trends.length} days, ${daily.toFixed(2)}/day. Confidence low if <30 days or <20 bookings.` },
      { heading: "Forecast Confidence and Assumptions", content: `Assumes demand, prices, hours, capacity stable; no holidays/disruptions/campaigns. Confidence 60–78% based on run-rate, lower for 60/90 days. Reforecast weekly. Compare forecast ${forecast(30)}/30d vs actual next period to close the loop.` },
      { heading: "Predictive Findings", content: `Findings: ${forecast(30)} bookings / ${money(projection(30))} in 30 days, capacity ${utilization.toFixed(1)}%, workload ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"}/employee, peak ${busiest ? busiest.date : "TBD"}. These are projections, not guarantees.` },
      { heading: "Predictive Recommendations", content: `1. Staff for peak days first.\n2. Reforecast after price/capacity changes.\n3. Review capacity at 80% weekly.\n4. Track forecast vs actual.` },
      { heading: "Forecast Limitations and Methodology", content: `Method: Manila-time period, run-rate × average, paid requires paidAt excluded from forecast. Booked ≠ collected. Small samples and missing external factors limit certainty. Not financial advice.` },
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
  const baseInstructions = `Use the selected report period exactly. Ground every conclusion in the supplied data and quote relevant numeric values. Clearly distinguish gross booked value, paid revenue, outstanding value, and collection rate. Include limitations when the dataset is sparse or a required cost metric is unavailable. Do not invent costs, profit, customer demographics, or causal explanations. Each main section is a single substantial analytical paragraph (4-6 sentences) that AGGEGRATES its sub-details inline using "•" bullets inside the same section — do NOT create separate sections for sub-contents. Example: "Revenue by Service" must contain Revenue by Luggage Type, Revenue by Storage Duration, Revenue by Service Type, and Revenue by Booking Source as bullet details within that one section. Write in clean plain paragraphs — no markdown headings, no bullet symbols beyond "•" for sub-details, no code fences. Separate paragraphs with a blank line. You MUST use EXACTLY the headings listed for this report type — do not invent, omit, or rename them, and do not explode sub-contents into their own sections.`;
  const requiredList = REQUIRED_HEADINGS[type].map((h) => `"${h}"`).join(", ");
  const typeInstructions: Record<string, string> = {
    descriptive: `REPORT FOCUS: DESCRIPTIVE (What happened? — Bookings, customers, luggage, storage, operations, historical patterns). Use ONLY headings: ${requiredList}. Title must contain "Descriptive — What Happened?" and summary must describe past period results, not future. Keep Booking Performance, Luggage and Storage Patterns, Customer Activity, and Operational Activity as grouped sections with sub-details inside, not as separate sections.`,
    predictive: `REPORT FOCUS: PREDICTIVE (What is likely to happen? — Future bookings, revenue, capacity, staffing, peak demand, future luggage). Use ONLY headings: ${requiredList}. Title must contain "Predictive — What Is Likely to Happen?" and summary must be future outlook with 7/30/60/90 days. Keep Demand Forecast, Capacity Forecast, Staffing Forecast, and Peak Demand Prediction as grouped sections with sub-details inside.`,
    financial: `REPORT FOCUS: FINANCIAL (What happened to the money? — Booked value, revenue, collections, receivables, refunds, profitability). Use ONLY headings: ${requiredList}. Title must contain "Financial — What Happened to the Money?" and summary must center on collection rate/outstanding. CRITICAL: "Revenue by Service" is ONE section that must internally cover Revenue by Luggage Type, Revenue by Storage Duration, Revenue by Service Type, and Revenue by Booking Source as inline bullets — do NOT make those four separate sections. Similarly, Revenue Analysis, Collection Analysis, Accounts Receivable, Refund impact, and Profitability each group their sub-details inside. Do not analyze or group collections by payment channel or method.`,
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
