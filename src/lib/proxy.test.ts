import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import proxy from "../proxy";

test("proxy redirects unauthenticated dashboard routes but leaves public routes open", async () => {
  const dashboard = await proxy(new NextRequest("https://dropnfly.example/dashboard/bookings"));
  assert.equal(dashboard.status, 307);
  assert.equal(dashboard.headers.get("location"), "https://dropnfly.example/login?callbackUrl=%2Fdashboard%2Fbookings");

  const publicBooking = await proxy(new NextRequest("https://dropnfly.example/book"));
  assert.equal(publicBooking.status, 200);

  const lookalike = await proxy(new NextRequest("https://dropnfly.example/dashboard-preview"));
  assert.equal(lookalike.status, 200);
});
