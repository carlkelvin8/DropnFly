import assert from "node:assert/strict";
import test from "node:test";

import { generateReport } from "./gemini";

const analytics = {
  totalBookings: 12,
  bookedValue: 12000,
  totalRevenue: 9000,
  outstandingValue: 3000,
  collectionRate: 75,
  avgBookingValue: 1000,
  avgPaidRevenuePerBooking: 750,
  averageDailyBookings: 2,
  storageUtilization: 40,
  storageCapacity: 50,
  activeEmployees: 3,
  totalCustomers: 10,
  repeatCustomers: 2,
  totalLuggageItems: 18,
  bookingsByStatus: [{ status: "DELIVERED", count: 8 }],
  paymentsByStatus: [{ status: "PAID", count: 5, amount: 5000 }],
  dailyTrend: [{ date: "2026-09-01", bookings: 4, bookedValue: 4000 }],
};

test("fallback analytics reports have focus-specific content", async () => {
  const descriptive = await generateReport("descriptive", analytics);
  const predictive = await generateReport("predictive", analytics);
  const financial = await generateReport("financial", analytics);

  assert.equal(descriptive.source, "deterministic");
  assert.equal(predictive.source, "deterministic");
  assert.equal(financial.source, "deterministic");
  // Exact admin outline — ensure distinct titles/summaries/headings per Final Separation
  assert.match(descriptive.title, /Descriptive/);
  assert.match(predictive.title, /Predictive/);
  assert.match(financial.title, /Financial/);
  // Headings must be from required outline, not duplicated generic
  const dHeadings = descriptive.sections.map((s) => s.heading);
  const pHeadings = predictive.sections.map((s) => s.heading);
  const fHeadings = financial.sections.map((s) => s.heading);
  assert.ok(dHeadings.includes("Booking Performance"));
  assert.ok(dHeadings.includes("Luggage and Storage Patterns"));
  const demandForecast = predictive.sections.find((section) => section.heading === "Demand Forecast")?.content || "";
  assert.match(demandForecast, /7-Day Forecast/);
  assert.match(demandForecast, /30-Day Forecast/);
  assert.match(demandForecast, /60-Day Forecast/);
  assert.match(demandForecast, /90-Day Forecast/);
  assert.ok(pHeadings.includes("Capacity Forecast"));
  assert.ok(fHeadings.includes("Revenue Analysis"));
  assert.ok(fHeadings.includes("Revenue by Service"));
  assert.ok(!fHeadings.includes("Payment Method Analysis"));
  assert.doesNotMatch(financial.sections.map((section) => section.content).join(" "), /payment method analysis/i);
  assert.notDeepEqual(descriptive.sections, predictive.sections);
  assert.notDeepEqual(predictive.sections, financial.sections);
  assert.match(predictive.summary, /60 days/);
  assert.match(financial.summary, /collection rate/);
  assert.match(descriptive.summary, /bookings/);
});
