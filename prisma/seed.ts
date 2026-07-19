import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.SUPABASE_URL });
const prisma = new PrismaClient({ adapter });

function generateRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `DROPFLY-${code}`;
}

function randomDate(daysAgo: number, daysRange: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo + Math.floor(Math.random() * daysRange));
  d.setHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 12);

  // ── Users ──
  const userData = [
    { name: "Admin", email: "admin@dropnfly.ph", role: "ADMIN" as const, isApproved: true },
    { name: "Staff Juan", email: "staff@dropnfly.ph", role: "STAFF" as const, isApproved: true },
    { name: "Maria Santos", email: "maria@dropnfly.ph", role: "STAFF" as const, isApproved: true },
    { name: "Pedro Reyes", email: "pedro@dropnfly.ph", role: "STAFF" as const, isApproved: true },
    { name: "Ana Cruz", email: "ana@dropnfly.ph", role: "EMPLOYEE" as const, isApproved: true, vehicleType: "Motorcycle", plateNumber: "ABC 1234" },
    { name: "Rico Bautista", email: "rico@dropnfly.ph", role: "EMPLOYEE" as const, isApproved: true, vehicleType: "Scooter", plateNumber: "XYZ 5678" },
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

  // ── Storage Location: Villamor, Pasay City (single location) ──
  const locationData = [
    { name: "Dropnfly Villamor", address: "Villamor Air Base, Pasay City", city: "Pasay", capacity: 200, pricePerDay: 50, openingTime: "06:00", closingTime: "22:00" },
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
    { name: "Juan Dela Cruz", email: "juan@email.com", phone: "+639171234567", countryOfOrigin: "Philippines", cityOfOrigin: "Manila" },
    { name: "Maria Clara", email: "maria.clara@email.com", phone: "+639179876543", countryOfOrigin: "Philippines", cityOfOrigin: "Cebu" },
    { name: "John Smith", email: "john.smith@email.com", phone: "+14155551234", countryOfOrigin: "United States", cityOfOrigin: "San Francisco" },
    { name: "Yuki Tanaka", email: "yuki@email.com", phone: "+81901234567", countryOfOrigin: "Japan", cityOfOrigin: "Tokyo" },
    { name: "Lee Soo-jin", email: "soojin@email.com", phone: "+82101234567", countryOfOrigin: "South Korea", cityOfOrigin: "Seoul" },
    { name: "Carlos Garcia", email: "carlos@email.com", phone: "+639181234567", countryOfOrigin: "Philippines", cityOfOrigin: "Davao" },
    { name: "Sarah Wilson", email: "sarah@email.com", phone: "+447911123456", countryOfOrigin: "United Kingdom", cityOfOrigin: "London" },
    { name: "Ahmed Hassan", email: "ahmed@email.com", phone: "+971501234567", countryOfOrigin: "UAE", cityOfOrigin: "Dubai" },
    { name: "Anna Schmidt", email: "anna@email.com", phone: "+491701234567", countryOfOrigin: "Germany", cityOfOrigin: "Berlin" },
    { name: "Roberto Silva", email: "roberto@email.com", phone: "+5511987654321", countryOfOrigin: "Brazil", cityOfOrigin: "São Paulo" },
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

  // ── Bookings with realistic data ──
  const adminUser = createdUsers.find((u) => u.email === "admin@dropnfly.ph")!;
  const location = createdLocations[0];

  const bookingConfigs = [
    { custIdx: 0, bags: 2, days: 1, status: "DELIVERED" as const, staffIdx: 1, terminal: "NAIA Terminal 1", airline: "Philippine Airlines", luggage: JSON.stringify([{ type: "Standard", qty: 1, price: 250 }, { type: "Small", qty: 1, price: 200 }]), services: ["Pick-up from Customer"], payment: "full" },
    { custIdx: 1, bags: 1, days: 3, status: "IN_STORAGE" as const, staffIdx: 2, terminal: "NAIA Terminal 3", airline: "Cebu Pacific", luggage: JSON.stringify([{ type: "Standard", qty: 1, price: 250 }]), services: [], payment: "full" },
    { custIdx: 2, bags: 3, days: 2, status: "CONFIRMED" as const, staffIdx: 3, terminal: "NAIA Terminal 1", airline: "United Airlines", luggage: JSON.stringify([{ type: "Large", qty: 1, price: 300 }, { type: "Small", qty: 2, price: 200 }]), services: ["Deliver to Customer"], payment: "dp" },
    { custIdx: 3, bags: 1, days: 5, status: "PENDING" as const, staffIdx: null, terminal: "NAIA Terminal 3", airline: "Japan Airlines", luggage: JSON.stringify([{ type: "Standard", qty: 1, price: 250 }]), services: [], payment: "dp" },
    { custIdx: 4, bags: 4, days: 1, status: "OUT_FOR_DELIVERY" as const, staffIdx: 4, terminal: "NAIA Terminal 1", airline: "Korean Air", luggage: JSON.stringify([{ type: "Small", qty: 2, price: 200 }, { type: "Standard", qty: 1, price: 250 }, { type: "Large", qty: 1, price: 300 }]), services: ["Pick-up from Customer", "Deliver to Customer"], payment: "full" },
    { custIdx: 5, bags: 2, days: 4, status: "DELIVERED" as const, staffIdx: 5, terminal: "NAIA Terminal 2", airline: "Singapore Airlines", luggage: JSON.stringify([{ type: "Standard", qty: 2, price: 250 }]), services: ["Pick-up from Customer"], payment: "full" },
    { custIdx: 6, bags: 1, days: 7, status: "IN_STORAGE" as const, staffIdx: 2, terminal: "NAIA Terminal 3", airline: "Emirates", luggage: JSON.stringify([{ type: "Large", qty: 1, price: 300 }]), services: ["Deliver to Customer"], payment: "full" },
    { custIdx: 7, bags: 2, days: 2, status: "RECEIVED" as const, staffIdx: 1, terminal: "NAIA Terminal 1", airline: "Qatar Airways", luggage: JSON.stringify([{ type: "Small", qty: 1, price: 200 }, { type: "Extra Small", qty: 1, price: 150 }]), services: ["Pick-up from Customer"], payment: "dp" },
    { custIdx: 8, bags: 3, days: 3, status: "CONFIRMED" as const, staffIdx: 3, terminal: "NAIA Terminal 3", airline: "Cathay Pacific", luggage: JSON.stringify([{ type: "Standard", qty: 1, price: 250 }, { type: "Small", qty: 1, price: 200 }, { type: "Extra Small", qty: 1, price: 150 }]), services: [], payment: "dp" },
    { custIdx: 9, bags: 5, days: 1, status: "DELIVERED" as const, staffIdx: 4, terminal: "NAIA Terminal 1", airline: "Turkish Airlines", luggage: JSON.stringify([{ type: "Standard", qty: 2, price: 250 }, { type: "Large", qty: 1, price: 300 }, { type: "Small", qty: 2, price: 200 }]), services: ["Pick-up from Customer", "Deliver to Customer"], payment: "full" },
    { custIdx: 0, bags: 1, days: 2, status: "DELIVERED" as const, staffIdx: 5, terminal: "NAIA Terminal 3", airline: "Philippine Airlines", luggage: JSON.stringify([{ type: "Small", qty: 1, price: 200 }]), services: [], payment: "full" },
    { custIdx: 1, bags: 2, days: 1, status: "PENDING" as const, staffIdx: null, terminal: "NAIA Terminal 1", airline: "AirAsia Philippines", luggage: JSON.stringify([{ type: "Standard", qty: 2, price: 250 }]), services: ["Pick-up from Customer"], payment: "dp" },
    { custIdx: 2, bags: 1, days: 3, status: "DELIVERED" as const, staffIdx: 1, terminal: "NAIA Terminal 2", airline: "Etihad Airways", luggage: JSON.stringify([{ type: "Standard", qty: 1, price: 250 }]), services: ["Deliver to Customer"], payment: "full" },
  ];

  const createdBookings: { ref: string; id: string }[] = [];

  const DELIVERED_STATUSES = new Set(["DELIVERED"]);
  const PAST_STATUSES = new Set(["CANCELLED", "NO_SHOW"]);

  for (let i = 0; i < bookingConfigs.length; i++) {
    const b = bookingConfigs[i];
    const ref = generateRef();
    const existing = await prisma.booking.findFirst({ where: { referenceNumber: ref } });
    if (existing) {
      createdBookings.push({ ref: existing.referenceNumber, id: existing.id });
      console.log(`Booking ${existing.referenceNumber} already exists, skipping`);
      continue;
    }

    const customer = createdCustomers[b.custIdx];
    const staffUser = b.staffIdx !== null ? createdUsers[b.staffIdx] : null;

    let pickupDate: Date;
    let deliveryDate: Date;

    if (DELIVERED_STATUSES.has(b.status)) {
      pickupDate = randomDate(5 + i * 1, 3);
      deliveryDate = addDays(pickupDate, b.days);
    } else if (PAST_STATUSES.has(b.status as string)) {
      pickupDate = randomDate(10 + i, 2);
      deliveryDate = addDays(pickupDate, b.days);
    } else {
      const futureDays = 1 + Math.floor(Math.random() * 5);
      pickupDate = addDays(new Date(), futureDays);
      deliveryDate = addDays(pickupDate, b.days);
    }

    const luggageItems = JSON.parse(b.luggage);
    const baseTotal = luggageItems.reduce((sum: number, item: { qty: number; price: number }) => sum + item.qty * item.price, 0);
    const extraFee = b.bags > 3 ? 100 : 0;
    const servicesFee = b.services.length * 180;
    const totalPrice = baseTotal + extraFee + servicesFee;
    const downPayment = b.payment === "full" ? totalPrice : Math.ceil(totalPrice * 0.5);

    const booking = await prisma.booking.create({
      data: {
        referenceNumber: ref,
        qrCode: "seed-qr-placeholder",
        userId: staffUser?.id || adminUser.id,
        customerId: customer.id,
        locationId: location.id,
        pickupLocation: `${b.terminal} - ${b.airline}`,
        dropOffLocation: "Villamor, Pasay City",
        luggageDetails: b.luggage,
        checkIn: pickupDate,
        checkOut: deliveryDate,
        numberOfBags: b.bags,
        totalPrice,
        status: b.status,
      },
    });
    createdBookings.push({ ref: ref, id: booking.id });
    console.log(`Created booking: ${ref} (${b.status}) - ₱${totalPrice}`);

    // Create assignment
    if (staffUser) {
      await prisma.bookingAssignment.create({
        data: { bookingId: booking.id, userId: staffUser.id },
      });
    }

    // Create payment record
    if (b.payment === "full") {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          customerId: customer.id,
          amount: totalPrice,
          method: "CASH",
          status: "PAID",
          paidAt: pickupDate,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          customerId: customer.id,
          amount: downPayment,
          method: "GCASH",
          status: "PAID",
          paidAt: pickupDate,
        },
      });
    }

    // Create loyalty points for DELIVERED bookings
    if (DELIVERED_STATUSES.has(b.status)) {
      const pointsEarned = Math.floor(totalPrice / 10);
      if (pointsEarned > 0) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { points: { increment: pointsEarned } },
        });
        await prisma.pointsTransaction.create({
          data: {
            customerId: customer.id,
            points: pointsEarned,
            type: "EARNED",
            reference: booking.id,
            description: `Earned from booking ${ref}`,
          },
        });
      }
    }
  }

  // ── Activity Logs ──
  const logActions = ["CREATE", "UPDATE", "UPDATE", "DELETE", "CREATE", "UPDATE"];
  const logEntities = ["Booking", "Customer", "Booking", "SystemSetting", "Booking", "Booking"];
  for (let i = 0; i < 6; i++) {
    const booking = createdBookings[i % createdBookings.length];
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: logActions[i],
        entity: logEntities[i],
        entityId: booking.id,
        details: `Activity log #${i + 1}: ${logActions[i]} ${logEntities[i]}`,
        createdAt: new Date(Date.now() - i * 3600000),
      },
    });
  }
  console.log("Created 6 activity logs");

  // ── Notifications ──
  for (const user of createdUsers.slice(0, 3)) {
    for (let i = 0; i < 3; i++) {
      const booking = createdBookings[i % createdBookings.length];
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: i === 0 ? "booking_created" : i === 1 ? "status_update" : "payment_received",
          title: i === 0 ? "New Booking Created" : i === 1 ? "Booking Status Updated" : "Payment Received",
          message: `Booking ${booking.ref} was ${i === 0 ? "created" : i === 1 ? "updated" : "paid"}`,
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
    { key: "max_capacity", value: "200" },
    { key: "business_hours_start", value: "06:00" },
    { key: "business_hours_end", value: "22:00" },
    { key: "allow_online_booking", value: "true" },
    { key: "extra_bag_fee", value: "100" },
    { key: "extra_bag_threshold", value: "3" },
    { key: "service_pickup_fee", value: "180" },
    { key: "service_delivery_fee", value: "180" },
  ];
  for (const s of settingData) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.log("Created/updated system settings");

  // ── Booking Extensions ──
  const firstBooking = createdBookings[0];
  const secondBooking = createdBookings[1];
  if (firstBooking) {
    const existingExt = await prisma.bookingExtension.findFirst({ where: { bookingId: firstBooking.id } });
    if (!existingExt) {
      await prisma.bookingExtension.create({
        data: {
          bookingId: firstBooking.id,
          requestedCheckOut: addDays(new Date(), 1),
          reason: "Need an extra day to pick up luggage",
          status: "APPROVED",
          reviewedById: adminUser.id,
          reviewedAt: new Date(),
        },
      });
      console.log("Created booking extension (approved)");
    }
  }

  if (secondBooking) {
    const existingExt = await prisma.bookingExtension.findFirst({ where: { bookingId: secondBooking.id } });
    if (!existingExt) {
      await prisma.bookingExtension.create({
        data: {
          bookingId: secondBooking.id,
          requestedCheckOut: addDays(new Date(), 2),
          reason: "Delayed flight, need extension",
          status: "PENDING",
        },
      });
      console.log("Created booking extension (pending)");
    }
  }

  // ── Chat Messages ──
  if (firstBooking) {
    const existingMsg = await prisma.chatMessage.findFirst({ where: { bookingId: firstBooking.id } });
    if (!existingMsg) {
      const customer = createdCustomers[0];
      const staffUser = createdUsers[1];
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
    }
  }

  // ── Booking Reviews ──
  if (firstBooking) {
    const existingReview = await prisma.bookingReview.findUnique({ where: { bookingId: firstBooking.id } });
    if (!existingReview) {
      const customer = createdCustomers[0];
      await prisma.bookingReview.create({
        data: { bookingId: firstBooking.id, customerId: customer.id, rating: 5, comment: "Great service! Fast delivery and friendly staff." },
      });
      console.log("Created booking review (5 stars)");
    }
  }

  // ── Luggage Items with tags ──
  for (const b of createdBookings.slice(0, 6)) {
    const existing = await prisma.luggageItem.findFirst({ where: { bookingId: b.id } });
    if (existing) continue;
    const bookingRecord = await prisma.booking.findUnique({ where: { id: b.id }, select: { numberOfBags: true } });
    const bagCount = bookingRecord?.numberOfBags || 1;
    for (let i = 0; i < bagCount; i++) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
      const statuses = ["DELIVERED", "IN_STORAGE", "CHECKED_IN", "IN_STORAGE", "DELIVERED", "DELIVERED"];
      const bIdx = createdBookings.indexOf(b);
      await prisma.luggageItem.create({
        data: {
          bookingId: b.id,
          tagNumber: `BAG-${code}`,
          description: `Bag ${i + 1} of ${bagCount}`,
          status: statuses[bIdx] || "CHECKED_IN",
          location: statuses[bIdx] === "IN_STORAGE" ? `Shelf ${String.fromCharCode(65 + (i % 5))}-${10 + i}` : null,
        },
      });
    }
    console.log(`Created ${bagCount} luggage items for ${b.ref}`);
  }

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
