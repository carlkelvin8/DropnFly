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
  paymentsByMethod: [{ method: "CASH", count: 5, amount: 5000 }],
  dailyTrend: [{ date: "2026-09-01", bookings: 4, bookedValue: 4000 }],
};

test("fallback analytics reports have focus-specific content", async () => {
  const descriptive = await generateReport("descriptive", analytics);
  const predictive = await generateReport("predictive", analytics);
  const financial = await generateReport("financial", analytics);

  assert.equal(descriptive.source, "deterministic");
  assert.equal(predictive.source, "deterministic");
  assert.equal(financial.source, "deterministic");
  assert.match(descriptive.sections[0].heading, /Booking Volume/);
  assert.match(predictive.sections[0].heading, /Forecast/);
  assert.match(financial.sections[0].heading, /Revenue/);
  assert.notDeepEqual(descriptive.sections, predictive.sections);
  assert.notDeepEqual(predictive.sections, financial.sections);
  assert.match(predictive.summary, /60 days/);
  assert.match(financial.summary, /collection rate/);
});
