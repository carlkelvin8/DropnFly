import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.SUPABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 12);

  // ── Users ──
  const userData = [
    { name: "Admin", email: "admin@dropnfly.ph", role: "ADMIN" as const, isApproved: true },
    { name: "Staff Juan", email: "staff@dropnfly.ph", role: "STAFF" as const, isApproved: true },
    { name: "Maria Santos", email: "maria@dropnfly.ph", role: "STAFF" as const, isApproved: true },
    { name: "Pedro Reyes", email: "pedro@dropnfly.ph", role: "STAFF" as const, isApproved: true },
    { name: "Ana Cruz", email: "ana@dropnfly.ph", role: "EMPLOYEE" as const, isApproved: false },
  ];

  const createdUsers: { email: string; id: string }[] = [];
  for (const u of userData) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      createdUsers.push({ email: u.email, id: existing.id });
      console.log(`User ${u.email} already exists, skipping`);
      continue;
    }
    const user = await prisma.user.create({ data: { ...u, password: hashedPassword } });
    createdUsers.push({ email: user.email, id: user.id });
    console.log(`Created user: ${u.email} / password123`);
  }

  // ── Storage Locations ──
  const locationData = [
    { name: "Makati Main Branch", address: "123 Ayala Ave", city: "Makati", capacity: 150, pricePerDay: 50, openingTime: "06:00", closingTime: "22:00" },
    { name: "BGC Branch", address: "45 Bonifacio High Street", city: "Taguig", capacity: 100, pricePerDay: 60, openingTime: "07:00", closingTime: "21:00" },
    { name: "MOA Branch", address: "SM Mall of Asia", city: "Pasay", capacity: 200, pricePerDay: 45, openingTime: "08:00", closingTime: "23:00" },
    { name: "Ortigas Branch", address: "Ortigas Center", city: "Pasig", capacity: 80, pricePerDay: 55, openingTime: "06:00", closingTime: "20:00" },
    { name: "Quezon City Branch", address: "88 North Ave", city: "Quezon City", capacity: 120, pricePerDay: 40, openingTime: "07:00", closingTime: "22:00" },
  ];

  const createdLocations: { name: string; id: string }[] = [];
  for (const loc of locationData) {
    const existing = await prisma.storageLocation.findFirst({ where: { name: loc.name } });
    if (existing) {
      createdLocations.push({ name: loc.name, id: existing.id });
      console.log(`Location ${loc.name} already exists, skipping`);
      continue;
    }
    const location = await prisma.storageLocation.create({ data: loc });
    createdLocations.push({ name: location.name, id: location.id });
    console.log(`Created location: ${loc.name}`);
  }

  // ── Customers ──
  const customerData = [
    { name: "John Doe", email: "john@email.com", phone: "09171234567" },
    { name: "Jane Smith", email: "jane@email.com", phone: "09179876543" },
    { name: "Bob Johnson", email: "bob@email.com", phone: "09175551234" },
    { name: "Alice Williams", email: "alice@email.com", phone: "09174445566" },
    { name: "Charlie Brown", email: "charlie@email.com", phone: "09173332211" },
  ];

  const createdCustomers: { email: string; id: string }[] = [];
  for (const c of customerData) {
    const existing = await prisma.customer.findUnique({ where: { email: c.email } });
    if (existing) {
      createdCustomers.push({ email: c.email, id: existing.id });
      console.log(`Customer ${c.email} already exists, skipping`);
      continue;
    }
    const customer = await prisma.customer.create({ data: c });
    createdCustomers.push({ email: customer.email, id: customer.id });
    console.log(`Created customer: ${c.name}`);
  }

  // ── Bookings ──

  const now = new Date();
  const bookingData = [
    { ref: "DROPFLY-SEED-001", customerEmail: "john@email.com", locName: "Makati Main Branch", bags: 2, days: 1, status: "DELIVERED" as const, staffEmail: "staff@dropnfly.ph", luggage: "2 suitcases, black" },
    { ref: "DROPFLY-SEED-002", customerEmail: "jane@email.com", locName: "BGC Branch", bags: 1, days: 3, status: "IN_STORAGE" as const, staffEmail: "maria@dropnfly.ph", luggage: "Backpack, blue" },
    { ref: "DROPFLY-SEED-003", customerEmail: "bob@email.com", locName: "MOA Branch", bags: 3, days: 2, status: "CONFIRMED" as const, staffEmail: "pedro@dropnfly.ph", luggage: "3 boxes, assorted" },
    { ref: "DROPFLY-SEED-004", customerEmail: "alice@email.com", locName: "Ortigas Branch", bags: 1, days: 5, status: "PENDING" as const, staffEmail: null, luggage: "Laptop bag" },
    { ref: "DROPFLY-SEED-005", customerEmail: "charlie@email.com", locName: "Quezon City Branch", bags: 4, days: 1, status: "OUT_FOR_DELIVERY" as const, staffEmail: "staff@dropnfly.ph", luggage: "4 duffel bags, red" },
  ];

  const adminUser = createdUsers.find((u) => u.email === "admin@dropnfly.ph")!;
  const createdBookings: { ref: string; id: string }[] = [];

  for (const b of bookingData) {
    const existing = await prisma.booking.findUnique({ where: { referenceNumber: b.ref } });
    if (existing) {
      createdBookings.push({ ref: b.ref, id: existing.id });
      console.log(`Booking ${b.ref} already exists, skipping`);
      continue;
    }

    const customer = createdCustomers.find((c) => c.email === b.customerEmail)!;
    const location = createdLocations.find((l) => l.name === b.locName)!;
    const staffUser = b.staffEmail ? createdUsers.find((u) => u.email === b.staffEmail) : null;

    const checkIn = new Date(now);
    checkIn.setDate(checkIn.getDate() - Math.floor(Math.random() * 10));
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + b.days);

    const locationObj = await prisma.storageLocation.findUnique({ where: { id: location.id } });
    const totalPrice = Math.max(1, b.days) * (locationObj?.pricePerDay || 50) * b.bags;

    const booking = await prisma.booking.create({
      data: {
        referenceNumber: b.ref,
        qrCode: "seed-qr-placeholder",
        userId: staffUser?.id || adminUser.id,
        customerId: customer.id,
        locationId: location.id,
        pickupLocation: locationObj?.address || "",
        dropOffLocation: "Customer Destination",
        luggageDetails: b.luggage,
        checkIn,
        checkOut,
        numberOfBags: b.bags,
        totalPrice,
        status: b.status,
      },
    });
    createdBookings.push({ ref: b.ref, id: booking.id });
    console.log(`Created booking: ${b.ref} (${b.status})`);

    // Create assignment if staff assigned
    if (staffUser) {
      await prisma.bookingAssignment.create({
        data: { bookingId: booking.id, userId: staffUser.id },
      });
    }
  }

  // ── Activity Logs ──
  const logActions = ["CREATE", "UPDATE", "UPDATE", "DELETE"];
  const logEntities = ["Booking", "Customer", "User", "SystemSetting"];
  for (let i = 0; i < 5; i++) {
    const booking = createdBookings[i % createdBookings.length];
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: logActions[i % logActions.length],
        entity: logEntities[i % logEntities.length],
        entityId: booking.id,
        details: `Seed activity log #${i + 1}`,
        createdAt: new Date(now.getTime() - i * 3600000),
      },
    });
  }
  console.log("Created 5 activity logs");

  // ── Notifications ──
  for (const user of createdUsers) {
    for (let i = 0; i < 2; i++) {
      const booking = createdBookings[i % createdBookings.length];
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: i === 0 ? "booking_created" : "status_update",
          title: i === 0 ? "New Booking Created" : "Booking Status Updated",
          message: `Booking ${booking.ref} was ${i === 0 ? "created" : "updated"}`,
          link: `/dashboard/bookings/${booking.id}`,
          isRead: i === 0,
        },
      });
    }
  }
  console.log("Created notifications");

  // ── System Settings ──
  const settingData = [
    { key: "price_per_bag", value: "50" },
    { key: "max_capacity", value: "500" },
    { key: "business_hours_start", value: "06:00" },
    { key: "business_hours_end", value: "22:00" },
    { key: "allow_online_booking", value: "true" },
  ];
  for (const s of settingData) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.log("Created/updated 5 system settings");

  // ── Booking Extensions ──
  const firstBooking = createdBookings[0];
  const secondBooking = createdBookings[1];
  if (firstBooking) {
    const existingExt = await prisma.bookingExtension.findFirst({ where: { bookingId: firstBooking.id } });
    if (!existingExt) {
      const checkOut = new Date(now);
      checkOut.setDate(checkOut.getDate() + 1);
      await prisma.bookingExtension.create({
        data: {
          bookingId: firstBooking.id,
          requestedCheckOut: checkOut,
          reason: "Need an extra day to pick up luggage",
          status: "APPROVED",
          reviewedById: adminUser.id,
          reviewedAt: new Date(),
        },
      });
      console.log("Created booking extension (approved)");
    } else {
      console.log("Booking extension already exists, skipping");
    }
  }

  if (secondBooking) {
    const existingExt = await prisma.bookingExtension.findFirst({ where: { bookingId: secondBooking.id } });
    if (!existingExt) {
      const checkOut = new Date(now);
      checkOut.setDate(checkOut.getDate() + 2);
      await prisma.bookingExtension.create({
        data: {
          bookingId: secondBooking.id,
          requestedCheckOut: checkOut,
          reason: "Delayed flight, need extension",
          status: "PENDING",
        },
      });
      console.log("Created booking extension (pending)");
    } else {
      console.log("Booking extension already exists, skipping");
    }
  }

  // ── Chat Messages ──
  if (firstBooking) {
    const existingMsg = await prisma.chatMessage.findFirst({ where: { bookingId: firstBooking.id } });
    if (!existingMsg) {
      const customer = createdCustomers.find((c) => c.email === "john@email.com")!;
      const staffUser = createdUsers.find((u) => u.email === "staff@dropnfly.ph")!;
      await prisma.chatMessage.create({
        data: { bookingId: firstBooking.id, customerId: customer.id, message: "Hi, when will my luggage be delivered?", isFromCustomer: true },
      });
      await prisma.chatMessage.create({
        data: { bookingId: firstBooking.id, senderId: staffUser.id, message: "Your luggage is on the way! ETA is within 2 hours.", isFromCustomer: false },
      });
      await prisma.chatMessage.create({
        data: { bookingId: firstBooking.id, customerId: customer.id, message: "Thank you!", isFromCustomer: true },
      });
      console.log("Created 3 chat messages");
    } else {
      console.log("Chat messages already exist, skipping");
    }
  }

  // ── Booking Reviews ──
  if (firstBooking) {
    const existingReview = await prisma.bookingReview.findUnique({ where: { bookingId: firstBooking.id } });
    if (!existingReview) {
      const customer = createdCustomers.find((c) => c.email === "john@email.com")!;
      await prisma.bookingReview.create({
        data: { bookingId: firstBooking.id, customerId: customer.id, rating: 5, comment: "Great service! Fast delivery and friendly staff." },
      });
      console.log("Created booking review (5 stars)");
    } else {
      console.log("Booking review already exists, skipping");
    }
  }

  // ── Luggage Items ──
  for (const b of createdBookings.slice(0, 3)) {
    const existing = await prisma.luggageItem.findFirst({ where: { bookingId: b.id } });
    if (existing) { console.log(`Luggage items for ${b.ref} already exist, skipping`); continue; }
    const bookingRecord = await prisma.booking.findUnique({ where: { id: b.id }, select: { numberOfBags: true, referenceNumber: true } });
    const bagCount = bookingRecord?.numberOfBags || 1;
    for (let i = 0; i < bagCount; i++) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
      await prisma.luggageItem.create({
        data: {
          bookingId: b.id,
          tagNumber: `BAG-${code}`,
          description: `Bag ${i + 1} of ${bagCount}`,
          status: b === createdBookings[0] ? "DELIVERED" : b === createdBookings[1] ? "IN_STORAGE" : "CHECKED_IN",
          location: b === createdBookings[1] ? "Shelf A-12" : null,
        },
      });
    }
    console.log(`Created ${bagCount} luggage items for ${b.ref}`);
  }

  // ── Loyalty Points ──
  const john = createdCustomers.find((c) => c.email === "john@email.com");
  if (john && firstBooking) {
    const existingTx = await prisma.pointsTransaction.findFirst({ where: { customerId: john.id } });
    if (!existingTx) {
      await prisma.customer.update({ where: { id: john.id }, data: { points: 250 } });
      await prisma.pointsTransaction.create({
        data: { customerId: john.id, points: 200, type: "EARNED", reference: firstBooking.id, description: "Earned from booking DROPFLY-SEED-001" },
      });
      await prisma.pointsTransaction.create({
        data: { customerId: john.id, points: 50, type: "EARNED", reference: firstBooking.id, description: "Bonus points for first booking" },
      });
      console.log("Created loyalty points for John (250 pts)");
    } else {
      console.log("Points already exist for John, skipping");
    }
  }

  const jane = createdCustomers.find((c) => c.email === "jane@email.com");
  if (jane) {
    const existingTx = await prisma.pointsTransaction.findFirst({ where: { customerId: jane.id } });
    if (!existingTx) {
      await prisma.customer.update({ where: { id: jane.id }, data: { points: 100 } });
      await prisma.pointsTransaction.create({
        data: { customerId: jane.id, points: 100, type: "EARNED", reference: "seed-bonus", description: "Welcome points" },
      });
      console.log("Created loyalty points for Jane (100 pts)");
    } else {
      console.log("Points already exist for Jane, skipping");
    }
  }

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
