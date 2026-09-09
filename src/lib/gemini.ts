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
// FINAL SEPARATION — as requested by admin outline (max level)
// Descriptive: Bookings, customers, luggage, storage, operations, historical patterns
// Financial: Booked value, revenue, collections, receivables, refunds, profitability
// Predictive: Future bookings, future revenue, capacity, staffing, peak demand, future luggage
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
  const methods = (data.paymentsByMethod as { method: string; count: number; amount: number }[] | undefined) || [];
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

  // Helpers for derived metrics
  const delivered = statuses.find((s) => s.status === "DELIVERED")?.count || 0;
  const cancelled = statuses.find((s) => s.status === "CANCELLED")?.count || 0;
  const pending = statuses.find((s) => s.status === "PENDING")?.count || 0;
  const inStorage = statuses.find((s) => s.status === "IN_STORAGE")?.count || 0;
  const totalPaidTx = methods.reduce((s, m) => s + m.count, 0);
  const refunds = Number((data as Record<string, unknown>).refundsAmount as number || 0);
  const refundCount = Number((data as Record<string, unknown>).refundsIssued as number || 0);

  if (type === "descriptive") {
    return {
      title: "Descriptive Analytics — What Happened?",
      summary: `${bookings} bookings were recorded in ${periodLabel}. They produced ${money(booked)} in booked value and ${money(paid)} in confirmed collections (${collectionRate.toFixed(1)}% collection rate) with ${luggage} luggage items.`,
      sections: [
        { heading: "Report Information", content: `This is a DESCRIPTIVE report (What happened?) for ${periodLabel}. Period: ${periodLabel}. Source: live DropnFly bookings, payments (PAID requires paidAt), luggage, customers, and employee records in Manila time. Generated ${new Date().toLocaleString("en-PH")}.\n\nScope: bookings, customers, luggage, storage, and operations. No forecasting — see Predictive report for future outlook. Financial health details are in the Financial report.` },
        { heading: "Executive Summary", content: `${bookings} bookings, ${customers} customers (${repeats} repeat, ${repeatRate.toFixed(1)}% return rate), and ${luggage} luggage items were recorded. Booked value ${money(booked)}, collected ${money(paid)}, outstanding ${money(outstanding)}. Average ${money(average)} per booking.\n\nBusiest day: ${busiest ? `${busiest.date} with ${busiest.bookings} bookings` : "insufficient daily activity to identify a peak"}. Storage utilization ${utilization.toFixed(1)}% of ${capacity} capacity via ${employees} active employees.` },
        { heading: "Booking Performance", content: `Overall booking performance for ${periodLabel}: ${bookings} total bookings at ${daily.toFixed(2)}/day. Status mix — ${statusText}.\n\nThis section aggregates volume, trend, and distribution for operational context.` },
        { heading: "Total Booking Volume", content: `Total bookings: ${bookings}. Valid bookings (excluding CANCELLED/NO_SHOW): ${bookings - cancelled}. Delivered: ${delivered}, Pending: ${pending}, In-Storage: ${inStorage}, Cancelled: ${cancelled}.\n\nVolume alone does not indicate revenue — see Revenue Analysis.` },
        { heading: "Booking Trend", content: `Daily trend points: ${trends.length} days. ${busiest ? `Peak was ${busiest.date} (${busiest.bookings} bookings, ${money(busiest.bookedValue)}).` : "No clear trend — sparse data."} Average ${daily.toFixed(2)}/day.\n\nCompare this trend with staffing and slot capacity before adjusting schedules.` },
        { heading: "Booking Status Distribution", content: `Distribution: ${statusText}.\n\nUse this to find bottlenecks (e.g., many CONFIRMED not yet RECEIVED, or many IN_STORAGE).` },
        { heading: "Luggage and Storage Patterns", content: `This section covers luggage mix, storage duration, and storage activity for ${periodLabel}. Total luggage items: ${luggage}.` },
        { heading: "Luggage Type Distribution", content: `Luggage items: ${luggage} across recorded bookings. Detailed type breakdown is available in baggage reports.\n\nSizing informs storage allocation and vehicle load planning.` },
        { heading: "Storage Duration", content: `Storage duration is measured from check-in to check-out per booking. Average booked value ${money(average)} already reflects duration multiplier.\n\nLong stays increase utilization — monitor at 80% capacity.` },
        { heading: "Storage Activity", content: `In-storage bookings: ${inStorage}. Utilization ${utilization.toFixed(1)}% of ${capacity} bags. ${capacity ? `${capacity - Math.round((utilization / 100) * capacity)} capacity units remain.` : "Capacity not configured — set max_simultaneous_bags in Settings."}\n\nReview weekly.` },
        { heading: "Customer Activity", content: `Customer activity for ${periodLabel}: ${customers} total customers, ${repeats} repeat (${repeatRate.toFixed(1)}%).\n\nThis aggregates retention and frequency signals.` },
        { heading: "Total Customers", content: `Total distinct customers: ${customers}.\n\nEach customer may have multiple bookings (returnees).` },
        { heading: "New Customers", content: `New customers in period: ${customers - repeats} (${customers ? (((customers - repeats) / customers) * 100).toFixed(1) : "0.0"}%).\n\nCompare with repeat count to assess acquisition.` },
        { heading: "Repeat Customers", content: `Repeat customers: ${repeats} (${repeatRate.toFixed(1)}%).\n\nThis is a period return rate, not lifetime retention.` },
        { heading: "Booking Frequency", content: `Average bookings per customer: ${customers ? (bookings / customers).toFixed(2) : "0.00"} for ${periodLabel}. Daily average ${daily.toFixed(2)}.\n\nFrequency helps size pickup/delivery windows.` },
        { heading: "Operational Activity", content: `Operational activity aggregates processing, delivery, storage, and employee signals for ${periodLabel}.` },
        { heading: "Booking Processing", content: `Processing queue: ${statusText}. Pending ${pending} and confirmed bookings require rider assignment and slot capacity.\n\nClear the largest active status first.` },
        { heading: "Delivery Activity", content: `Delivery-related statuses: OUT_FOR_DELIVERY and DELIVERED. Delivered in period: ${delivered}.\n\nTrack delivery vs pickup vehicle sharing (fleet capacity).` },
        { heading: "Storage Activity", content: `Storage activity: ${inStorage} currently in storage, utilization ${utilization.toFixed(1)}%.\n\nThis mirrors the storage snapshot above with operational lens.` },
        { heading: "Employee Activity", content: `Active employees: ${employees}. Workload est. ${employees ? (bookings / employees).toFixed(1) : "0.0"} bookings per employee for ${periodLabel}.\n\nAlign rosters to busiest days.` },
        { heading: "Historical Patterns and Observations", content: `${busiest ? `Historical peak was ${busiest.date} with ${busiest.bookings} bookings.` : "No strong historical pattern — data sparse."} Repeat rate ${repeatRate.toFixed(1)}%, collection ${collectionRate.toFixed(1)}%.\n\nThese are observed patterns, not forecasts.` },
        { heading: "Descriptive Findings", content: `What happened: ${bookings} bookings, ${money(booked)} booked vs ${money(paid)} collected, ${luggage} bags, ${utilization.toFixed(1)}% storage used, ${repeatRate.toFixed(1)}% repeat.\n\nInterpret with period length and data completeness in mind.` },
        { heading: "Data Limitations", content: `Limited to recorded events in ${periodLabel}. Missing payments, incomplete statuses, or activity outside period can change interpretation. Small samples increase uncertainty.` },
        { heading: "Descriptive Recommendations", content: `1. Reconcile the largest active status queue.\n\n2. Compare busiest day with employee roster.\n\n3. Validate storage vs staffing at current utilization.\n\n4. Track same metrics next period for trend.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  if (type === "financial") {
    const fullyPaid = methods.reduce((a, m) => a + (m.count || 0), 0); // proxy
    return {
      title: "Financial Analytics — What Happened to the Money?",
      summary: `Financial health for ${periodLabel}: ${money(booked)} booked, ${money(paid)} collected, ${money(outstanding)} outstanding (${collectionRate.toFixed(1)}% collection rate). Average ${money(average)} per booking.`,
      sections: [
        { heading: "Report Information", content: `This is a FINANCIAL report (What happened to the money?) for ${periodLabel}. Scope: booked value, revenue, collections, receivables, refunds, and profitability limits. Payment Method Analysis is intentionally excluded per spec.\n\nSource: live bookings and payments (PAID requires paidAt) in Manila time. Generated ${new Date().toLocaleString("en-PH")}.` },
        { heading: "Financial Executive Summary", content: `Booked ${money(booked)} vs collected ${money(paid)} vs outstanding ${money(outstanding)} at ${collectionRate.toFixed(1)}% collection. Average booked ${money(average)}, average paid ${money(averagePaid)}.\n\nRevenue is not profit — costs unavailable.` },
        { heading: "Revenue Analysis", content: `Revenue analysis for ${periodLabel} covers gross booked, collected, trend, average, and verification.` },
        { heading: "Gross Booked Value", content: `Gross booked value (valid bookings, excluding CANCELLED/NO_SHOW): ${money(booked)} from ${bookings - cancelled} bookings.\n\nThis is quoted value, not cash collected.` },
        { heading: "Collected Revenue", content: `Collected revenue (PAID with paidAt): ${money(paid)} from ${totalPaidTx} paid transactions.\n\nUse paidAt-verified figures for collection reporting.` },
        { heading: "Revenue Trend", content: `Trend points: ${trends.length} days. ${busiest ? `Peak revenue day ${busiest.date} ${money(busiest.bookedValue)}.` : "No clear revenue trend — sparse data."} Average ${money(average)} per booking.\n\nCompare with operational peaks.` },
        { heading: "Average Booking Value", content: `Average booked ${money(average)} vs average paid ${money(averagePaid)}. Outliers can skew averages — review large bookings before repricing.` },
        { heading: "Collection Analysis", content: `Collection analysis aggregates collected, outstanding, collection rate, and payment status mix for ${periodLabel}.` },
        { heading: "Total Collected", content: `Total collected: ${money(paid)}.\n\nVerified via paidAt timestamp.` },
        { heading: "Total Outstanding", content: `Total outstanding: ${money(outstanding)} (booked ${money(booked)} − collected ${money(paid)}).\n\nThis is the collectible pool before cancellations/disputes.` },
        { heading: "Collection Rate", content: `Collection rate: ${collectionRate.toFixed(1)}% (${money(paid)} / ${money(booked)}).\n\nMonitor per cycle; low rate indicates follow-up needed.` },
        { heading: "Fully Paid Bookings", content: `Fully paid bookings: those where paid sum ≥ booked value. Exact count requires per-booking reconciliation; aggregate collected ${money(paid)} indicates overall fully-paid share.\n\nReconcile per booking for precise count.` },
        { heading: "Partially Paid Bookings", content: `Partially paid bookings: paid sum >0 but < booked value. Contributes to outstanding ${money(outstanding)}.\n\nPrioritize by age and amount.` },
        { heading: "Unpaid Bookings", content: `Unpaid bookings: no PAID payment yet. Part of outstanding ${money(outstanding)}.\n\nSeparate valid receivables from cancelled/disputed.` },
        { heading: "Accounts Receivable / Outstanding Balance", content: `This section details outstanding by booking, customer, and aging for ${periodLabel}. Outstanding ${money(outstanding)} is the aggregate receivable.` },
        { heading: "Outstanding by Booking", content: `Outstanding by booking: sum of (booked − paid) per valid booking. Total ${money(outstanding)}.\n\nLargest balances first for collection.` },
        { heading: "Outstanding by Customer", content: `Outstanding by customer: aggregate per ${customers} customers. Repeat customers ${repeats} may carry multiple balances.\n\nGroup by customer for outreach.` },
        { heading: "Aging of Receivables", content: `Aging requires per-booking paidAt vs createdAt. Total outstanding ${money(outstanding)} should be aged buckets (<7d, 7-30d, >30d) once data available.\n\nBuild aging from payment timestamps.` },
        { heading: "Refund and Cancellation Financial Impact", content: `Impact of refunds and cancellations for ${periodLabel}: ${cancelled} cancelled bookings, ${refundCount} refunds ${refunds ? money(refunds) : ""}.\n\nCancellations reduce booked value; refunds reduce collected.` },
        { heading: "Total Refunds", content: `Total refunds: ${refundCount} transactions.\n\nCount from REFUNDED payments.` },
        { heading: "Refund Rate", content: `Refund rate: ${bookings ? ((refundCount / bookings) * 100).toFixed(2) : "0.00"}% of bookings.\n\nCompare with cancellation rate ${(bookings ? ((cancelled / bookings) * 100).toFixed(2) : "0.00")}%.\` ` },
        { heading: "Refund Amount", content: `Refund amount: ${refunds ? money(refunds) : money(0)}.\n\nReconcile with provider settlements.` },
        { heading: "Financial Impact of Cancellations", content: `Cancelled bookings: ${cancelled} removed from revenue. Booked value ${money(booked)} excludes CANCELLED/NO_SHOW.\n\nTrack cancellation reasons to reduce leakage.` },
        { heading: "Revenue by Service", content: `Revenue by service aggregates service, luggage type, duration, and source for ${periodLabel}.` },
        { heading: "Revenue by Luggage Type", content: `Luggage type revenue derived from luggage details × days. Total booked ${money(booked)} includes luggage mix.\n\nSee baggage reports for type split.` },
        { heading: "Revenue by Storage Duration", content: `Revenue by duration: longer stays increase booked value via days multiplier. Average ${money(average)} reflects duration.\n\nAnalyze duration vs utilization.` },
        { heading: "Revenue by Service Type", content: `Service type revenue: pickup/delivery fees added to luggage subtotal. Detailed service split requires luggageDetails services aggregation.\n\nReconcile service fees separately.` },
        { heading: "Revenue by Booking Source, if available", content: `Booking source (walk-in vs online) revenue split not stored per booking in this schema — source field unavailable.\n\nIf needed, add source field to bookings.` },
        { heading: "Profitability Analysis", content: `Profitability analysis for ${periodLabel} — limited by cost data availability.` },
        { heading: "Total Expenses", content: `Total expenses: data not recorded in schema (no expense table). Cannot compute.\n\nAdd expense ledger to enable.` },
        { heading: "Operating Expenses", content: `Operating expenses: payroll, rent, fees not recorded. Cannot compute.\n\nAdd period-matched expense capture.` },
        { heading: "Net Income", content: `Net income: cannot calculate — requires ${money(booked)} booked vs costs. Revenue must not be presented as profit.` },
        { heading: "Profit Margin", content: `Profit margin: cannot calculate without expenses. Collection rate ${collectionRate.toFixed(1)}% is not margin.\n\nAdd costs to report margin.` },
        { heading: "Only if expense data exists", content: `Expense-dependent profitability metrics are omitted because expense data does not exist in the current dataset for ${periodLabel}.` },
        { heading: "Financial Findings", content: `Findings: ${money(booked)} booked, ${money(paid)} collected, ${money(outstanding)} outstanding at ${collectionRate.toFixed(1)}% collection. Refunds ${refundCount}, cancelled ${cancelled}.\n\nCollections are the verified cash signal.` },
        { heading: "Financial Recommendations", content: `1. Reconcile every outstanding balance by booking and customer.\n\n2. Age receivables and prioritize >30d.\n\n3. Match payments to settlements; investigate refunds.\n\n4. Add expense tracking before reporting profit.` },
        { heading: "Financial Limitations and Methodology", content: `Method: Manila-time period, PAID requires paidAt, booked excludes CANCELLED/NO_SHOW, outstanding = booked − paid. Payment Method Analysis removed per spec. Profitability requires costs.\n\nSource: live DropnFly DB.` },
        { heading: "Payment Method Analysis is completely removed.", content: `Per spec, Payment Method Analysis is excluded from this financial report. See operational data for payment mix if needed externally.` },
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
      { heading: "Report Information", content: `This is a PREDICTIVE report (What is likely to happen?) for ${periodLabel}. Scope: future bookings, revenue, capacity, staffing, peak demand, luggage demand. Based on run-rate (${daily.toFixed(2)}/day) and ${money(average)} avg, not guarantees.\n\nGenerated ${new Date().toLocaleString("en-PH")}.` },
      { heading: "Forecast Executive Summary", content: `Forecast: ${forecast(7)} bookings in 7 days, ${forecast(30)} in 30 days, ${forecast(60)} in 60 days, ${forecast(90)} in 90 days. Expected booked value ${money(projection(30))} in 30 days. Capacity ${utilization.toFixed(1)}% of ${capacity}, ${employees} employees.\n\nConfidence limited if history short/sparse.` },
      { heading: "Demand Forecast", content: `Demand forecast aggregates 7/30/60/90-day booking volumes from ${daily.toFixed(2)}/day run-rate for ${periodLabel}.` },
      { heading: "7-Day Forecast", content: `7-day forecast: ${forecast(7)} bookings, ${money(projection(7))} booked value at ${money(average)} avg.\n\nUse for weekly rostering.` },
      { heading: "30-Day Forecast", content: `30-day forecast: ${forecast(30)} bookings, ${money(projection(30))} booked value.\n\nThis is the primary planning horizon.` },
      { heading: "60-Day Forecast", content: `60-day forecast: ${forecast(60)} bookings, ${money(projection(60))} booked value.\n\nIntermediate capacity check.` },
      { heading: "90-Day Forecast", content: `90-day forecast: ${forecast(90)} bookings, ${money(projection(90))} booked value.\n\nLong-range, lower confidence.` },
      { heading: "Future Revenue Forecast", content: `Future revenue forecast for ${periodLabel} based on run-rate and average.` },
      { heading: "Expected Booked Value", content: `Expected booked value: ${money(projection(7))} in 7 days, ${money(projection(30))} in 30 days, ${money(projection(60))} in 60 days, ${money(projection(90))} in 90 days at ${money(average)} avg.\n\nExcludes future cancellations/costs.` },
      { heading: "Expected Revenue", content: `Expected revenue (collected) at ${collectionRate.toFixed(1)}% collection: ~${money(projection(30) * (collectionRate / 100))} in 30 days.\n\nApply collection rate to booked projection.` },
      { heading: "Capacity Forecast", content: `Capacity forecast for ${periodLabel}: current ${utilization.toFixed(1)}% of ${capacity} bags.` },
      { heading: "Expected Storage Demand", content: `Expected storage demand: ~${forecast(30)} bookings in 30 days implies ~${forecast(30)} bag-groups (avg ${(luggage / Math.max(1, bookings)).toFixed(1)} bags/booking).\n\nCompare with capacity ${capacity}.` },
      { heading: "Expected Storage Utilization", content: `Expected utilization: current ${utilization.toFixed(1)}%. At +${forecast(30)} bookings, utilization may rise; review weekly at 80% threshold.\n\nRun-rate cannot model overlapping stays precisely.` },
      { heading: "Expected Bags in Storage", content: `Expected bags in storage: current active ${data.storageUsed as number || 0} bags. Add ~${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} bag-items in 30 days (rough).\n\nUse daily occupancy, not just bookings.` },
      { heading: "Capacity Pressure", content: `Capacity pressure: ${utilization >= 80 ? "High — review expansion" : utilization >= 50 ? "Moderate — monitor" : "Low"} at ${utilization.toFixed(1)}%.\n\nTrigger review at 80%.` },
      { heading: "Staffing / Workload Forecast", content: `Staffing forecast for ${periodLabel} with ${employees} active employees.` },
      { heading: "Expected Booking Volume", content: `Expected booking volume: ${forecast(7)}/7d, ${forecast(30)}/30d, ${forecast(60)}/60d, ${forecast(90)}/90d.\n\nDistribute by time slots.` },
      { heading: "Expected Luggage Volume", content: `Expected luggage volume: ~${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} items in 30 days at current mix.\n\nVehicle load planning.` },
      { heading: "Employee Workload", content: `Employee workload: ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} bookings per employee in 30 days (avg).\n\nUse slot peaks before changing rosters.` },
      { heading: "Potential Staffing Requirements", content: `Potential staffing: at current productivity, ${employees} staff for ${forecast(30)} bookings. Add cover for peak days ${busiest ? busiest.date : "TBD"}.\n\nHire/OT decision needs peak analysis.` },
      { heading: "Peak Demand Prediction", content: `Peak demand prediction for ${periodLabel} based on observed ${trends.length} days.` },
      { heading: "Predicted High-Demand Periods", content: `${busiest ? `High-demand observed ${busiest.date} with ${busiest.bookings} bookings.` : "No high-demand period identified — sparse data."} Expect similar weekday/time patterns.\n\nPrepare cover.` },
      { heading: "Predicted Low-Demand Periods", content: `Low-demand: days with 0-1 bookings in history. Use low periods for maintenance/training.\n\nValidate with longer history.` },
      { heading: "Expected Peak Volume", content: `Expected peak volume: ~${busiest ? busiest.bookings : Math.ceil(daily * 1.5)} bookings on peak day (historical peak as proxy).\n\nPlan vehicle and counter capacity.` },
      { heading: "Future Luggage Demand", content: `Future luggage demand for ${periodLabel}.` },
      { heading: "Predicted Demand by Luggage Type", content: `Predicted luggage mix: proportional to current ${luggage} items. Type split requires luggage breakdown.\n\nSee baggage reports for mix.` },
      { heading: "Expected Storage Requirements", content: `Expected storage: ${utilization.toFixed(1)}% now; +30d demand may push toward ${Math.min(100, utilization + 5).toFixed(1)}% (rough).\n\nReview capacity weekly.` },
      { heading: "Cancellation / No-Show Prediction", content: `${cancelled ? `Historical cancellations: ${cancelled} of ${bookings} (${bookings ? ((cancelled / bookings) * 100).toFixed(1) : "0.0"}%).` : "Insufficient cancellation history for prediction."} ${bookings < 10 ? "Only if sufficient historical data exists — currently sparse, low confidence." : "Use for overbooking buffer."}` },
      { heading: "Only if sufficient historical data exists", content: `This prediction is only valid if sufficient historical data exists. Current history: ${bookings} bookings over ${trends.length} days, ${daily.toFixed(2)}/day. Confidence low if <30 days or <20 bookings.` },
      { heading: "Forecast Confidence and Assumptions", content: `Assumes demand, prices, hours, capacity stable; no holidays/disruptions/campaigns. Confidence 60-78% based on run-rate, lower for 60/90 days.\n\nReforecast weekly.` },
      { heading: "Forecast vs. Actual Performance", content: `Compare forecast ${forecast(30)}/30d vs actual next period. Track variance and recalibrate.\n\nThis closes the loop for next cycle.` },
      { heading: "Predictive Findings", content: `Findings: ${forecast(30)} bookings / ${money(projection(30))} in 30 days, capacity ${utilization.toFixed(1)}%, workload ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"}/employee, peak ${busiest ? busiest.date : "TBD"}.\n\nThese are projections, not guarantees.` },
      { heading: "Predictive Recommendations", content: `1. Staff for peak days first.\n\n2. Reforecast after price/capacity changes.\n\n3. Review capacity at 80% weekly.\n\n4. Track forecast vs actual.` },
      { heading: "Forecast Limitations and Methodology", content: `Method: Manila-time period, run-rate × average, paid requires paidAt excluded from forecast. Booked ≠ collected. Small samples and missing external factors limit certainty.\n\nNot financial advice.` },
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
  sections: { heading?: unknown; content?: unknown }[] | undefined,
  type: "descriptive" | "predictive" | "financial"
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

// Exact admin outline per spec — ensures Gemini cannot return generic duplicated headings
const REQUIRED_HEADINGS: Record<string, string[]> = {
  descriptive: [
    "Report Information",
    "Executive Summary",
    "Booking Performance",
    "Total Booking Volume",
    "Booking Trend",
    "Booking Status Distribution",
    "Luggage and Storage Patterns",
    "Luggage Type Distribution",
    "Storage Duration",
    "Storage Activity",
    "Customer Activity",
    "Total Customers",
    "New Customers",
    "Repeat Customers",
    "Booking Frequency",
    "Operational Activity",
    "Booking Processing",
    "Delivery Activity",
    "Storage Activity",
    "Employee Activity",
    "Historical Patterns and Observations",
    "Descriptive Findings",
    "Data Limitations",
    "Descriptive Recommendations",
  ],
  financial: [
    "Report Information",
    "Financial Executive Summary",
    "Revenue Analysis",
    "Gross Booked Value",
    "Collected Revenue",
    "Revenue Trend",
    "Average Booking Value",
    "Collection Analysis",
    "Total Collected",
    "Total Outstanding",
    "Collection Rate",
    "Fully Paid Bookings",
    "Partially Paid Bookings",
    "Unpaid Bookings",
    "Accounts Receivable / Outstanding Balance",
    "Outstanding by Booking",
    "Outstanding by Customer",
    "Aging of Receivables",
    "Refund and Cancellation Financial Impact",
    "Total Refunds",
    "Refund Rate",
    "Refund Amount",
    "Financial Impact of Cancellations",
    "Revenue by Service",
    "Revenue by Luggage Type",
    "Revenue by Storage Duration",
    "Revenue by Service Type",
    "Revenue by Booking Source, if available",
    "Profitability Analysis",
    "Total Expenses",
    "Operating Expenses",
    "Net Income",
    "Profit Margin",
    "Only if expense data exists",
    "Financial Findings",
    "Financial Recommendations",
    "Financial Limitations and Methodology",
    "Payment Method Analysis is completely removed.",
  ],
  predictive: [
    "Report Information",
    "Forecast Executive Summary",
    "Demand Forecast",
    "7-Day Forecast",
    "30-Day Forecast",
    "60-Day Forecast",
    "90-Day Forecast",
    "Future Revenue Forecast",
    "Expected Booked Value",
    "Expected Revenue",
    "Capacity Forecast",
    "Expected Storage Demand",
    "Expected Storage Utilization",
    "Expected Bags in Storage",
    "Capacity Pressure",
    "Staffing / Workload Forecast",
    "Expected Booking Volume",
    "Expected Luggage Volume",
    "Employee Workload",
    "Potential Staffing Requirements",
    "Peak Demand Prediction",
    "Predicted High-Demand Periods",
    "Predicted Low-Demand Periods",
    "Expected Peak Volume",
    "Future Luggage Demand",
    "Predicted Demand by Luggage Type",
    "Expected Storage Requirements",
    "Cancellation / No-Show Prediction",
    "Only if sufficient historical data exists",
    "Forecast Confidence and Assumptions",
    "Forecast vs. Actual Performance",
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
  if (!Array.isArray(sections) || sections.length < 10) return false;
  const headings = sections.map((s) => String(s.heading || "").toLowerCase().trim());
  const required = REQUIRED_HEADINGS[type] || [];
  // At least 70% of required headings must be present and in order-ish
  const hits = required.filter((req) => headings.some((h) => h === req.toLowerCase()));
  if (hits.length < required.length * 0.7) return false;
  // Ensure no cross-type leakage: descriptive must not contain predictive financial-only headings like "Gross Booked Value" etc.
  const forbidden: Record<string, string[]> = {
    descriptive: ["gross booked value", "expected booked value", "7-day forecast"],
    financial: ["booking performance", "7-day forecast", "luggage type distribution"],
    predictive: ["gross booked value", "booking performance", "total customers"],
  };
  const bad = (forbidden[type] || []).some((kw) => headings.some((h) => h.includes(kw)));
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
  const baseInstructions = `Use the selected report period exactly. Ground every conclusion in the supplied data and quote relevant numeric values. Clearly distinguish gross booked value, paid revenue, outstanding value, and collection rate. Include limitations when the dataset is sparse or a required cost metric is unavailable. Do not invent costs, profit, customer demographics, or causal explanations. Each section must be a substantial analytical paragraph (3-5 sentences) with findings, interpretation, and a specific operational implication. Write in clean plain paragraphs — no markdown headings, no bullet symbols, no code fences. Separate paragraphs with a blank line. You MUST use EXACTLY the headings listed for this report type — do not invent, omit, or rename them.`;
  const requiredList = REQUIRED_HEADINGS[type].map((h) => `"${h}"`).join(", ");
  const typeInstructions: Record<string, string> = {
    descriptive: `REPORT FOCUS: DESCRIPTIVE (What happened? — Bookings, customers, luggage, storage, operations, historical patterns). Use ONLY headings: ${requiredList}. Title must contain "Descriptive — What Happened?" and summary must describe past period results, not future.`,
    predictive: `REPORT FOCUS: PREDICTIVE (What is likely to happen? — Future bookings, revenue, capacity, staffing, peak demand, future luggage). Use ONLY headings: ${requiredList}. Title must contain "Predictive — What Is Likely to Happen?" and summary must be future outlook with 7/30/60/90 days.`,
    financial: `REPORT FOCUS: FINANCIAL (What happened to the money? — Booked value, revenue, collections, receivables, refunds, profitability). Use ONLY headings: ${requiredList}. Title must contain "Financial — What Happened to the Money?" and summary must center on collection rate/outstanding. Payment Method Analysis is completely removed — do not include it.`,
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

    const sections = normalizeSections(parsed.sections, type);
    const title = cleanGeminiContent(String(parsed.title || "")).slice(0, 120) || `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
    const summary = cleanGeminiContent(String(parsed.summary || "")).replace(/\s+/g, " ").trim().slice(0, 600);

    if (!isDistinctReport({ title, summary, sections }, type) || sections.length < 10) {
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
