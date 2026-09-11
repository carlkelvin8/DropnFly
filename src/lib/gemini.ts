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
      summary: `Sa ${periodLabel}, may ${bookings} bookings tayo na nagkakahalagang ${money(booked)} — nakakolekta na ng ${money(paid)} (${collectionRate.toFixed(1)}% collection, ${luggage} bags). Sa madaling salita: ito yung aktwal na nangyari, hindi hula.`,
      sections: [
        { heading: "Report Information", content: `Anong klaseng report ito? Descriptive — ibig sabihin, kwento ng nakaraan, hindi hula. Sakop ng ${periodLabel} (Manila time), base sa tunay na bookings, payments (PAID lang pag may paidAt), luggage at employees. Ginawa noong ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. Kung gusto mo ng hula, tingnan ang Predictive; kung pera, Financial.` },
        { heading: "Executive Summary", content: `Kumusta tayo? May ${bookings} bookings mula sa ${customers} customers — ${repeats} ang bumalik ( ${repeatRate.toFixed(1)}% ). ${luggage} bags ang nahawakan. Kumita ng ${money(booked)} sa papel, ${money(paid)} ang tunay na pumasok, may ${money(outstanding)} pa na hindi pa bayad. Average ${money(average)} per booking.\n\nPinaka-busy: ${busiest ? `${busiest.date} — ${busiest.bookings} bookings (${money(busiest.bookedValue)})` : "wala pang malinaw na peak, konti pa data"}. Sa storage, ${utilization.toFixed(1)}% puno (${capacity} capacity) hawak ng ${employees} tauhan. Ibig sabihin, ${utilization >= 80 ? "medyo sikip na" : utilization >= 50 ? "sakto lang" : "maluwag pa"} tayo.` },
        { heading: "Booking Performance", content: `Dito pinagsama-sama ang tatlong tingin sa bookings para hindi kalat-kalat.\n\n• Total Booking Volume: ${bookings} lahat-lahat; malinis (walang CANCELLED/NO_SHOW) ${bookings - cancelled}. Delivered ${delivered}, Pending ${pending}, Nasa storage ${inStorage}, Cancelled ${cancelled}. Tandaan: dami ng booking hindi agad kita.\n• Booking Trend: ${trends.length} araw na data. ${busiest ? `Pinakamataas noong ${busiest.date} — ${busiest.bookings} bookings` : "wala pa malinaw na trend, paunti-unti pa lang"}. Average ${daily.toFixed(2)}/araw — ikumpara sa dami ng rider bago magdagdag ng tao.\n• Booking Status Distribution: ${statusText}. Dito makikita kung saan nag-iipon — hal. maraming CONFIRMED pero di pa RECEIVED, o maraming IN_STORAGE na naghihintay i-deliver.` },
        { heading: "Luggage and Storage Patterns", content: `Paano gumalaw ang bagahe at storage (${luggage} items lahat).\n\n• Luggage Type Distribution: ${luggage} items — tingnan sa baggage report kung Small/Large ba madalas, para maayos ang lagayan at sasakyan.\n• Storage Duration: sinusukat mula check-in hanggang check-out. Kasama na sa ${money(average)} ang dagdag sa matagal na stay — habang tumatagal, masikip sa storage, bantayan pag 80% na.\n• Storage Activity: ${inStorage} ang nasa bodega ngayon, ${utilization.toFixed(1)}% ng ${capacity || "—"} capacity. ${capacity ? `${capacity - Math.round((utilization / 100) * capacity)} pwesto pa ang bakante — weekly check.` : "Wala pang capacity na naka-set, lagay mo sa Settings > max_simultaneous_bags."}` },
        { heading: "Customer Activity", content: `Sino ang mga customers?\n\n• Total Customers: ${customers} unique na tao (pwedeng maraming booking bawat isa).\n• New Customers: ${customers - repeats} (${customers ? (((customers - repeats) / customers) * 100).toFixed(1) : "0.0"}%) — ito yung bago, ikumpara sa bumalik para malaman kung effective ang nakuha ng bago.\n• Repeat Customers: ${repeats} (${repeatRate.toFixed(1)}% bumalik sa period na ito).\n• Booking Frequency: ${customers ? (bookings / customers).toFixed(2) : "0.00"} bookings per customer; ${daily.toFixed(2)}/araw. Kung mataas, ibig sabihin nagtitiwala — ayusin ang pickup window para sa kanila.` },
        { heading: "Operational Activity", content: `Paano tumakbo ang operasyon?\n\n• Booking Processing: pila ay ${statusText}. Unahin ang pinakamarami — lalo na Pending ${pending} na kailangan ng rider.\n• Delivery Activity: OUT_FOR_DELIVERY at DELIVERED — ${delivered} ang na-deliver sa period. Tandaan kung shared ang sasakyan sa pickup/delivery.\n• Storage Activity: ${inStorage} nasa bodega, ${utilization.toFixed(1)}% puno — parehong tingin sa itaas pero pang-operations.\n• Employee Activity: ${employees} tauhan; kung hatiin, ~${employees ? (bookings / employees).toFixed(1) : "0.0"} bookings per tao ngayong ${periodLabel}. I-tugma ang schedule sa pinaka-busy na araw.` },
        { heading: "Historical Patterns and Observations", content: `${busiest ? `Napansin natin na pinakamatao noong ${busiest.date} (${busiest.bookings} bookings).` : "Wala pa masyadong pattern — kaunti pa data."} Bumalik ${repeatRate.toFixed(1)}%, nakolekta ${collectionRate.toFixed(1)}%. Ito ay obserbasyon lang, hindi garantisadong mauulit.` },
        { heading: "Descriptive Findings", content: `Buod: ${bookings} bookings, ${money(booked)} sa papel vs ${money(paid)} kolekta, ${luggage} bags, ${utilization.toFixed(1)}% storage, ${repeatRate.toFixed(1)}% bumalik. Tingnan ito kasama ang haba ng period — pag mas mahaba, mas malinaw ang picture.` },
        { heading: "Data Limitations", content: `Hanggang sa na-record lang sa ${periodLabel}. Kung may hindi na-log na payment o nasa labas ng period, pwedeng mag-iba ang kwento. Pag konti pa lang data, mas malaki ang agwat ng hula.` },
        { heading: "Descriptive Recommendations", content: `1. Ayusin muna ang pinakamaraming nakapila na status.\n2. Ikumpara ang busiest day sa roster ng tao.\n3. Tignan kung kaya pa ng storage at tao sa ${utilization.toFixed(1)}%.\n4. Ulitin next period para makita ang trend.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  if (type === "financial") {
    return {
      title: "Financial Analytics — What Happened to the Money?",
      summary: `Sa pera: nag-book ng ${money(booked)}, nakolekta ${money(paid)}, may ${money(outstanding)} pa na hindi pa bayad (${collectionRate.toFixed(1)}% collection rate) — average ${money(average)} per booking sa ${periodLabel}.`,
      sections: [
        { heading: "Report Information", content: `Ano ito? Financial report — saan napunta ang pera sa ${periodLabel}. Base sa tunay na bookings at payments (PAID lang pag may paidAt), Manila time, ginawa noong ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. Ang payment ay bilang lang pag verified ang paidAt.` },
        { heading: "Financial Executive Summary", content: `Simple lang: nag-book ${money(booked)}, pumasok ${money(paid)}, kulang pa ${money(outstanding)} — ${collectionRate.toFixed(1)}% pa lang ang nakolekta. Average na booked ${money(average)}, average na bayad ${money(averagePaid)}. Paalala: kita sa papel hindi pa tubo — wala pa tayong gastos na naka-record.` },
        { heading: "Revenue Analysis", content: `Pinagsama-sama ang apat na tingin sa revenue para buo ang picture.\n\n• Gross Booked Value: ${money(booked)} mula sa ${bookings - cancelled} valid bookings (walang CANCELLED/NO_SHOW) — ito yung sinisingil, hindi pa hawak.\n• Collected Revenue: ${money(paid)} mula sa ${totalPaidTx} bayad na may paidAt — ito lang ang sigurado, gamitin ito sa report ng koleksyon.\n• Revenue Trend: ${trends.length} araw na data; ${busiest ? `pinakamataas na kita noong ${busiest.date} — ${money(busiest.bookedValue)}` : "wala pa malinaw na trend"}. Average ${money(average)} per booking — ikumpara sa busy days ng operasyon.\n• Average Booking Value: booked ${money(average)} vs bayad ${money(averagePaid)}. May malalaki na booking na humihila pataas ng average — silipin bago magtaas ng presyo.` },
        { heading: "Collection Analysis", content: `Kumusta ang singilan?\n\n• Total Collected: ${money(paid)} — verified via paidAt, ito lang ang cash talaga.\n• Total Outstanding: ${money(outstanding)} (booked ${money(booked)} minus collected ${money(paid)}) — ito pa ang sisingilin.\n• Collection Rate: ${collectionRate.toFixed(1)}% — pag mababa, may kailangang follow-up.\n• Fully Paid / Partially Paid / Unpaid: fully paid = bayad ≥ sinisingil; partially = may bayad pero kulang (dagdag sa ${money(outstanding)}); unpaid = wala pang PAID. Para malaman ang eksaktong bilang, kailangan per-booking na kwenta — pero sa total na ${money(paid)}, kita na kung gaano karami ang fully paid. Unahin ang malaki at matagal na.` },
        { heading: "Accounts Receivable / Outstanding Balance", content: `Sino pa ang may utang? Total ${money(outstanding)} pa ang receivable.\n\n• Outstanding by Booking: (sinisingil minus bayad) kada booking — kabuuan ${money(outstanding)}, unahin ang pinakamalaki.\n• Outstanding by Customer: hatiin sa ${customers} customers (yung ${repeats} na umulit pwedeng may dalawang utang) — pagsama-samahin per customer para isang tawag lang.\n• Aging: dapat hatiin sa <7 araw, 7–30, >30 — wala pa tayong detalye per booking, pero gawin ito gamit ang paidAt vs createdAt. Total ${money(outstanding)} ang dapat i-bucket.` },
        { heading: "Refund and Cancellation Financial Impact", content: `Ano epekto ng refund at cancel?\n\n• Total Refunds: ${refundCount} transactions.\n• Refund Rate: ${bookings ? ((refundCount / bookings) * 100).toFixed(2) : "0.00"}% — ikumpara sa cancel rate ${(bookings ? ((cancelled / bookings) * 100).toFixed(2) : "0.00")}%.\n• Refund Amount: ${refunds ? money(refunds) : money(0)} — i-reconcile sa settlement ng provider.\n• Cancellations: ${cancelled} bookings ang natanggal sa kita. Ang ${money(booked)} ay wala nang CANCELLED/NO_SHOW. Alamin kung bakit nagka-cancel para mabawasan.` },
        { heading: "Revenue by Service", content: `Saan galing ang kita? Pinagsama-sama para hindi kalat.\n\n• By Luggage Type: depende sa laki ng bagahe × araw ng storage. Kasama na sa ${money(booked)} ang halo ng luggage — tingnan ang baggage report para sa eksaktong hati.\n• By Storage Duration: mas matagal = mas malaki singil dahil sa araw. Kasama na sa ${money(average)} ang tagal — tingnan kasama ng utilization.\n• By Service Type: dagdag ang pickup/delivery fee sa luggage. Para sa detalye, kailangang i-sum ang services sa luggageDetails.\n• By Booking Source: walk-in vs online — wala pa tayong source field sa schema, kung kailangan, dagdagan ng source ang bookings.` },
        { heading: "Profitability Analysis", content: `Tubo ba? Hindi pa natin masabi.\n\n• Total/Operating Expenses: wala pa tayong expense table — hindi ma-compute. Kailangan ng ledger ng gastos.\n• Net Income / Profit Margin: hindi makwenta mula sa ${money(booked)} lang — hindi tubo ang kita. Ang ${collectionRate.toFixed(1)}% ay collection, hindi margin.\n• Kaya wala munang profitability numbers — magdagdag muna ng gastos para sa ${periodLabel}.` },
        { heading: "Financial Findings", content: `Nakita: ${money(booked)} sinisingil, ${money(paid)} nakolekta, ${money(outstanding)} kulang (${collectionRate.toFixed(1)}%). Refunds ${refundCount}, cancelled ${cancelled}. Ang koleksyon ang tunay na cash.` },
        { heading: "Financial Recommendations", content: `1. Isa-isahin ang bawat may utang per booking/customer.\n2. I-aging ang utang at unahin ang >30 araw.\n3. I-match ang payments sa settlement, imbestigahan ang refund.\n4. Magdagdag ng expense tracking bago mag-report ng tubo.` },
        { heading: "Financial Limitations and Methodology", content: `Paano kinwenta: Manila time ang period; PAID lang pag may paidAt; gross booked walang CANCELLED/NO_SHOW; outstanding = booked minus collected. Walang tubo hanggat walang gastos. Base sa live bookings at payments.` },
      ],
      generatedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  // predictive
  return {
    title: "Predictive Analytics — What Is Likely to Happen?",
    summary: `Hula para sa ${periodLabel}: sa takbong ${daily.toFixed(2)}/araw, aasahan natin ${forecast(7)} bookings sa 7 araw, ${forecast(30)} sa 30 araw — posibleng ${money(projection(30))} ang kita sa papel sa susunod na buwan (average ${money(average)}). 60 days forecast: ${forecast(60)} bookings. Hindi ito sigurado, gabay lang.`,
    sections: [
      { heading: "Report Information", content: `Anong klaseng report? Predictive — hula kung anong posibleng mangyari sa ${periodLabel}. Base sa takbo (${daily.toFixed(2)}/araw) at average ${money(average)}, hindi pangako. Ginawa noong ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.` },
      { heading: "Forecast Executive Summary", content: `Sa madaling salita: ${forecast(7)} bookings sa 7 araw, ${forecast(30)} sa 30 araw, ${forecast(60)} sa 60, ${forecast(90)} sa 90. Kung average ${money(average)}, pwedeng ${money(projection(30))} sa 30 araw. Sa ngayon ${utilization.toFixed(1)}% puno ang storage (${capacity} capacity) hawak ng ${employees} tao — tandaan, pag maikli pa ang history, mas malabo ang hula.` },
      { heading: "Demand Forecast", content: `Ilang bookings kaya ang darating? Base sa ${daily.toFixed(2)}/araw.\n\n• 7-Day Forecast: ${forecast(7)} bookings — ${money(projection(7))} sa papel, pang weekly schedule.\n• 30-Day Forecast: ${forecast(30)} bookings — ${money(projection(30))}, ito ang pinaka-gamitin sa plano.\n• 60-Day Forecast: ${forecast(60)} bookings — ${money(projection(60))}, pang gitnang tanaw.\n• 90-Day Forecast: ${forecast(90)} bookings — ${money(projection(90))}, malayo pa kaya mas hindi sigurado.` },
      { heading: "Future Revenue Forecast", content: `Magkano kaya ang kita?\n\n• Expected Booked Value: ${money(projection(7))} sa 7 araw, ${money(projection(30))} sa 30, ${money(projection(60))} sa 60, ${money(projection(90))} sa 90 (average ${money(average)}, hindi pa kasama ang kansela).\n• Kung ${collectionRate.toFixed(1)}% ang nakokolekta, mga ${money(projection(30) * (collectionRate / 100))} ang tunay na papasok sa 30 araw — i-multiply ang hula sa collection rate.` },
      { heading: "Capacity Forecast", content: `Kakayanin pa ba ng bodega? Ngayon ${utilization.toFixed(1)}% ng ${capacity} bags ang puno.\n\n• Expected Storage Demand: mga ${forecast(30)} bookings sa 30 araw, ibig sabihin mga ${forecast(30)} grupo ng bags (average ${(luggage / Math.max(1, bookings)).toFixed(1)} per booking) — ikumpara sa ${capacity}.\n• Utilization: ngayon ${utilization.toFixed(1)}% — pag nadagdagan ng ${forecast(30)} bookings, tataas pa, weekly check lalo na pag 80% na.\n• Bags in Storage: may ${data.storageUsed as number || 0} bags ngayon, dagdag ~${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} sa 30 araw — tantya lang, mas maganda tingnan ang araw-araw na laman.\n• Pressure: ${utilization >= 80 ? "Mataas — isipin na mag-expand" : utilization >= 50 ? "Katamtaman — bantayan" : "Mababa pa"} sa ${utilization.toFixed(1)}%. Pag 80% na, mag-review.` },
      { heading: "Staffing / Workload Forecast", content: `Kaya pa ba ng tao? May ${employees} tayo ngayon.\n\n• Expected Volume: ${forecast(7)}/7 araw, ${forecast(30)}/30, ${forecast(60)}/60, ${forecast(90)}/90 — hatiin sa oras ng pickup/delivery.\n• Luggage Volume: ~${Math.round((luggage / Math.max(1, bookings)) * forecast(30))} items sa 30 araw — para sa sasakyan.\n• Workload: ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} bookings per tao sa 30 araw — tingnan ang peak na oras bago magdagdag ng tao.\n• Kailan magdagdag? Sa ngayon ${employees} tao para sa ${forecast(30)} bookings. Magdagdag ng extra sa peak na araw ${busiest ? busiest.date : "TBD"}.` },
      { heading: "Peak Demand Prediction", content: `Kailan tayo dadagsain? Base sa ${trends.length} araw na nakita.\n\n• High-Demand: ${busiest ? `pinakamatao noong ${busiest.date} — ${busiest.bookings} bookings` : "wala pa malinaw na peak, kaunti pa data"} — asahan na similar na araw/oras, maghanda ng tao.\n• Low-Demand: mga araw na 0–1 lang — pwede gamitin sa linis/training, pero kumpirmahin pag mas mahaba na history.\n• Peak Volume: mga ${busiest ? busiest.bookings : Math.ceil(daily * 1.5)} bookings sa isang araw — dito ibuhos ang sasakyan at tao.` },
      { heading: "Future Luggage Demand", content: `Ano kaya ang bagahe? \n\n• By Luggage Type: hatiin base sa ${luggage} items ngayon — tingnan ang baggage report para sa Small/Large.\n• Storage: ${utilization.toFixed(1)}% ngayon, baka umabot ng ${Math.min(100, utilization + 5).toFixed(1)}% sa 30 araw — tantya lang, weekly check.` },
      { heading: "Cancellation / No-Show Prediction", content: `${cancelled ? `May ${cancelled} sa ${bookings} ang na-cancel (${bookings ? ((cancelled / bookings) * 100).toFixed(1) : "0.0"}%).` : "Wala pa sapat na history ng cancel para makahula."} ${bookings < 10 ? "Kaunti pa lang data — malabo pa ang hula." : "Pwedeng gamitin pang-buffer sa overbooking."}\n\nTandaan: ${bookings} bookings sa ${trends.length} araw, ${daily.toFixed(2)}/araw. Mababa ang confidence pag <30 araw o <20 bookings.` },
      { heading: "Forecast Confidence and Assumptions", content: `Ang hula ay assuming walang biglang bago — presyo, oras ng bukas, capacity pareho lang, walang holiday o promo. Confidence 60–78% lang, mas mababa sa 60/90 araw. Mag-reforecast linggo-linggo at ikumpara ang hula (${forecast(30)}/30 araw) sa aktwal.` },
      { heading: "Predictive Findings", content: `Nakita: ${forecast(30)} bookings / ${money(projection(30))} sa 30 araw, ${utilization.toFixed(1)}% puno, ${employees ? (forecast(30) / employees).toFixed(1) : "0.0"} per tao, peak ${busiest ? busiest.date : "TBD"}. Hula lang ito, hindi garantisado.` },
      { heading: "Predictive Recommendations", content: `1. Unahin ang tao sa peak days.\n2. Mag-reforecast pag may bagong presyo o capacity.\n3. Weekly check pag 80% na storage.\n4. I-track kung tumama ang hula.` },
      { heading: "Forecast Limitations and Methodology", content: `Paano kinwenta: Manila time ang period, takbo × average, PAID lang pag may paidAt. Booked hindi kolekta. Pag konti pa sample, malaki ang agwat. Hindi ito financial advice.` },
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
  const baseInstructions = `Use the selected report period exactly. Ground every conclusion in the supplied data and quote relevant numeric values. Clearly distinguish gross booked value, paid revenue, outstanding value, and collection rate. Include limitations when the dataset is sparse or a required cost metric is unavailable. Do not invent costs, profit, customer demographics, or causal explanations. Each main section is a single substantial analytical paragraph (4-6 sentences) that AGGEGRATES its sub-details inline using "•" bullets inside the same section — do NOT create separate sections for sub-contents. Example: "Revenue by Service" must contain Revenue by Luggage Type, Revenue by Storage Duration, Revenue by Service Type, and Revenue by Booking Source as bullet details within that one section.

CRITICAL HUMAN TONE: Write like a real Filipino operations manager talking to the owner — warm, simple, Taglish, conversational. Use short sentences, varied length, contractions (it's, hindi). Start sections with human phrases like "Sa madaling salita," or "Kumusta tayo?". Explain numbers as if teaching a new staff — no AI clichés like "In conclusion" or "It is important to note" or "As an AI". No markdown headings, no bullet symbols beyond "•" for sub-details, no code fences. Separate paragraphs with a blank line. You MUST use EXACTLY the headings listed for this report type — do not invent, omit, or rename them, and do not explode sub-contents into their own sections.`;
  const requiredList = REQUIRED_HEADINGS[type].map((h) => `"${h}"`).join(", ");
  const typeInstructions: Record<string, string> = {
    descriptive: `REPORT FOCUS: DESCRIPTIVE (What happened? — Bookings, customers, luggage, storage, operations, historical patterns). Use ONLY headings: ${requiredList}. Title must contain "Descriptive — What Happened?" and summary must describe past period results in human Taglish — e.g., "Sa period na ito, may X bookings...". Keep Booking Performance, Luggage and Storage Patterns, Customer Activity, and Operational Activity as grouped sections with sub-details inside, not as separate sections. Sound human, not AI.`,
    predictive: `REPORT FOCUS: PREDICTIVE (What is likely to happen? — Future bookings, revenue, capacity, staffing, peak demand, future luggage). Use ONLY headings: ${requiredList}. Title must contain "Predictive — What Is Likely to Happen?" and summary must be future outlook with 7/30/60/90 days in human Taglish — e.g., "Sa susunod na 30 araw, aasahan...". Keep Demand Forecast, Capacity Forecast, Staffing Forecast, and Peak Demand Prediction as grouped sections with sub-details inside. Sound human, not AI.`,
    financial: `REPORT FOCUS: FINANCIAL (What happened to the money? — Booked value, revenue, collections, receivables, refunds, profitability). Use ONLY headings: ${requiredList}. Title must contain "Financial — What Happened to the Money?" and summary must center on collection rate/outstanding in human Taglish — e.g., "Sa pera, nakolekta...". CRITICAL: "Revenue by Service" is ONE section that must internally cover Revenue by Luggage Type, Revenue by Storage Duration, Revenue by Service Type, and Revenue by Booking Source as inline bullets — do NOT make those four separate sections. Similarly, Revenue Analysis, Collection Analysis, Accounts Receivable, Refund impact, and Profitability each group their sub-details inside. Do not analyze or group collections by payment channel or method. Sound human, not AI.`,
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
