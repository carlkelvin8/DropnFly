import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import proxy, { hasCustomerTrackingAccess } from "../proxy";

test("proxy redirects unauthenticated dashboard routes but leaves public routes open", async () => {
  const dashboard = await proxy(new NextRequest("https://dropnfly.example/dashboard/bookings"));
  assert.equal(dashboard.status, 307);
  assert.equal(dashboard.headers.get("location"), "https://dropnfly.example/login?callbackUrl=%2Fdashboard%2Fbookings");

  const publicBooking = await proxy(new NextRequest("https://dropnfly.example/book"));
  assert.equal(publicBooking.status, 200);

  const lookalike = await proxy(new NextRequest("https://dropnfly.example/dashboard-preview"));
  assert.equal(lookalike.status, 200);
});

test("customer tracking cookies keep the rider map on the customer route", () => {
  const bookingAccess = new NextRequest("https://dropnfly.example/track/map/DNF-123", {
    headers: { cookie: "booking_access=signed-grant" },
  });
  const customerSession = new NextRequest("https://dropnfly.example/track/map/DNF-123", {
    headers: { cookie: "customer_token=signed-customer" },
  });
  const unrelated = new NextRequest("https://dropnfly.example/track/map/DNF-123", {
    headers: { cookie: "some_cookie=value" },
  });

  assert.equal(hasCustomerTrackingAccess(bookingAccess), true);
  assert.equal(hasCustomerTrackingAccess(customerSession), true);
  assert.equal(hasCustomerTrackingAccess(unrelated), false);
});
